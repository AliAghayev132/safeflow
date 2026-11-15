/* This file intentionally exports a hook (useSocket) alongside the provider,
   and the connection effect drives an external system (Socket.IO). */
/* eslint-disable react-refresh/only-export-components, react-hooks/set-state-in-effect */
import { createContext, useContext, useEffect, useState } from 'react'
import { io } from 'socket.io-client'
import { useDispatch, useSelector, useStore } from 'react-redux'

import { baseApi, API_ORIGIN, ALL_TAGS } from '../api/baseApi'
import { eventsBatched } from '../slices/liveSlice'
import { alertIncoming, connectionChanged, realtimeCursor, toast } from '../slices/uiSlice'
import { playAlarm } from '@utils'

const SocketContext = createContext(null)

// Server → client event types (backend/constants/shared/events.js)
export const SOCKET_EVENTS = {
  SOS_NEW: 'sos:new',
  SOS_UPDATED: 'sos:updated',
  SHELTER_UPDATED: 'shelter:updated',
  ROAD_UPDATED: 'road:updated',
  BRIGADE_UPDATED: 'brigade:updated',
  ALERT_NEW: 'alert:new',
  ALERT_UPDATED: 'alert:updated',
  STATS_UPDATED: 'stats:updated',
  CONFIG_UPDATED: 'config:updated',
  SCENARIO_UPDATED: 'scenario:updated',
  SYSTEM_RESET: 'system:reset',
}

const FLUSH_MS = 200
const FALLBACK_AFTER_MS = 10000
const POLL_EVERY_MS = 5000

/**
 * Realtime with graceful degradation:
 *   1. Socket.IO (`evt` messages with a monotonic `seq`). After a reconnect
 *      the console asks for everything it missed (`sync`), or refetches all
 *      data when the server says `resync` / its epoch changed.
 *   2. If the socket can't connect for ~10 s → poll GET /api/events every
 *      5 s until it reconnects.
 * Mode (live / polling / connecting / offline) is shown in the header.
 */
export const SocketProvider = ({ children }) => {
  const dispatch = useDispatch()
  const store = useStore()
  const accessToken = useSelector((state) => state.auth.accessToken)
  const [socket, setSocket] = useState(null)

  useEffect(() => {
    if (!accessToken) {
      setSocket(null)
      dispatch(connectionChanged('offline'))
      return
    }

    let cursor = { epoch: null, seq: 0 }
    let fallbackTimer = null
    let pollTimer = null
    let queueTimer = null
    let disposed = false
    const E = SOCKET_EVENTS

    // Cursor lives in this closure; the UI copy (System page) is refreshed on
    // (re)connect and once per flush — not once per event.
    const saveCursor = () => dispatch(realtimeCursor({ ...cursor }))
    const refetchAll = () => dispatch(baseApi.util.invalidateTags(ALL_TAGS))
    // Profiles for new tickets come with the queue endpoint — coalesce refetches
    // (at most one queue refetch per 5 s, even during an SOS flood)
    const refreshQueueSoon = () => {
      if (queueTimer) return
      queueTimer = setTimeout(() => {
        queueTimer = null
        dispatch(baseApi.util.invalidateTags(['Queue']))
      }, 5000)
    }

    // ---- Event batching ----
    // During an SOS flood dozens of events arrive per second. Applying each one
    // separately re-rendered every subscriber per event. Instead events are
    // buffered and flushed every FLUSH_MS as ONE reducer call (one render).
    let buffer = []
    let flushTimer = null
    let alarmPending = false

    const flush = () => {
      flushTimer = null
      if (!buffer.length) return
      const batch = buffer
      buffer = []
      dispatch(eventsBatched(batch))
      for (const { type, data } of batch) {
        if (type === E.ALERT_NEW) {
          dispatch(alertIncoming(data.id))
          alarmPending = true
        }
      }
      if (alarmPending && !store.getState().ui.muted) playAlarm()
      alarmPending = false
      dispatch(realtimeCursor({ ...cursor }))
    }

    const handle = (type, data) => {
      switch (type) {
        case E.SOS_NEW:
          refreshQueueSoon()
          buffer.push({ type, data })
          break
        case E.BRIGADE_UPDATED: {
          buffer.push({ type, data })
          const mine = store.getState().auth.operator?.brigade
          if (mine && mine === data.id) dispatch(baseApi.util.invalidateTags(['MyBrigade']))
          break
        }
        case E.CONFIG_UPDATED:
          dispatch(baseApi.util.invalidateTags(['Config', 'Rules']))
          return
        case E.SYSTEM_RESET:
          buffer = []
          refetchAll()
          dispatch(toast.info('toast.systemReset'))
          return
        default:
          buffer.push({ type, data })
      }
      // A new red alert is flushed immediately; everything else is coalesced
      if (type === E.ALERT_NEW) {
        clearTimeout(flushTimer)
        flush()
      } else if (!flushTimer) {
        flushTimer = setTimeout(flush, FLUSH_MS)
      }
    }

    const apply = (evt) => {
      if (!evt || evt.seq <= cursor.seq) return // duplicate / already applied
      if (cursor.epoch && evt.epoch && evt.epoch !== cursor.epoch) {
        // Server restarted — sequence numbers reset; rebuild from REST
        refetchAll()
        cursor = { epoch: evt.epoch, seq: evt.seq }
        saveCursor()
        return
      }
      handle(evt.type, evt.data)
      cursor = { epoch: evt.epoch ?? cursor.epoch, seq: evt.seq }
    }

    const applyBatch = (res) => {
      if (!res) return
      if (res.resync) {
        refetchAll()
        dispatch(toast.info('connection.resynced'))
        cursor = { epoch: res.epoch, seq: res.lastSeq }
        saveCursor()
        return
      }
      res.events.forEach(apply)
    }

    // ---- Polling fallback ----
    const poll = async () => {
      try {
        const params = new URLSearchParams({ after: String(cursor.seq) })
        if (cursor.epoch) params.set('epoch', cursor.epoch)
        const res = await fetch(`${API_ORIGIN}/api/events?${params}`, {
          headers: { Authorization: `Bearer ${accessToken}` },
        })
        if (res.status === 401) {
          dispatch({ type: 'auth/logout' })
          return
        }
        if (!res.ok) throw new Error(String(res.status))
        const body = await res.json()
        applyBatch(body.data)
        if (!disposed) dispatch(connectionChanged('polling'))
      } catch {
        if (!disposed) dispatch(connectionChanged('offline'))
      }
    }
    const startPolling = () => {
      if (pollTimer || disposed) return
      poll()
      pollTimer = setInterval(poll, POLL_EVERY_MS)
    }
    const stopPolling = () => {
      clearInterval(pollTimer)
      pollTimer = null
    }

    // ---- Socket ----
    const s = io(API_ORIGIN, {
      auth: { client: 'operator', token: accessToken },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 8000,
    })

    const scheduleFallback = () => {
      if (fallbackTimer || pollTimer) return
      fallbackTimer = setTimeout(() => {
        fallbackTimer = null
        if (!s.connected) startPolling()
      }, FALLBACK_AFTER_MS)
    }

    dispatch(connectionChanged('connecting'))

    s.on('connect', () => {
      clearTimeout(fallbackTimer)
      fallbackTimer = null
      stopPolling()
      dispatch(connectionChanged('live'))
    })

    s.on('hello', ({ epoch, lastSeq }) => {
      if (!cursor.epoch) {
        // First connection — REST snapshot is the baseline
        cursor = { epoch, seq: lastSeq }
        saveCursor()
        return
      }
      if (cursor.epoch !== epoch) {
        refetchAll()
        dispatch(toast.info('connection.resynced'))
        cursor = { epoch, seq: lastSeq }
        saveCursor()
        return
      }
      // Reconnected to the same server: replay missed events
      s.emit('sync', { afterSeq: cursor.seq, epoch }, applyBatch)
    })

    s.on('evt', apply)

    s.on('disconnect', () => {
      if (!pollTimer) dispatch(connectionChanged('connecting'))
      scheduleFallback()
    })
    s.on('connect_error', () => {
      if (!pollTimer) dispatch(connectionChanged('connecting'))
      scheduleFallback()
    })

    setSocket(s)
    return () => {
      disposed = true
      clearTimeout(fallbackTimer)
      clearTimeout(queueTimer)
      clearTimeout(flushTimer)
      stopPolling()
      s.removeAllListeners()
      s.disconnect()
    }
  }, [accessToken, dispatch, store])

  return <SocketContext.Provider value={{ socket }}>{children}</SocketContext.Provider>
}

export const useSocket = () => {
  const context = useContext(SocketContext)
  if (!context) {
    throw new Error('useSocket must be used within a SocketProvider')
  }
  return context
}

export default SocketContext
