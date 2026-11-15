/* This file exports a hook (useSocket) alongside the provider, and the
   connection effect drives an external system (Socket.IO). */
/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useEffect } from 'react'
import { useDispatch, useSelector, useStore } from 'react-redux'
import { io } from 'socket.io-client'

import { API_ORIGIN, baseApi, ALL_TAGS } from '@store/api'
import { selectDeviceId, setTransport } from '@store/slices'
import { applyEvent, useConnectivity, useOutbox } from '@store/hooks'
import { storage } from '@utils'

const SocketContext = createContext(null)

const CURSOR_KEY = 'crisis.rt.cursor'
const FALLBACK_AFTER_MS = 10000
const POLL_EVERY_MS = 5000

const loadCursor = () => {
  try {
    return JSON.parse(storage.get(CURSOR_KEY) ?? 'null') ?? { epoch: null, seq: 0 }
  } catch {
    return { epoch: null, seq: 0 }
  }
}

/**
 * Realtime with graceful degradation:
 *   1. Socket.IO (auto-reconnect). Every event has a monotonic `seq`; after a
 *      reconnect the client asks the server for everything it missed (`sync`).
 *   2. If the socket can't connect for ~10 s → HTTP polling of /api/events
 *      every 5 s until the socket is back.
 *   3. Offline → saved data + SOS outbox (see useOutbox).
 */
export const SocketProvider = ({ children }) => {
  const deviceId = useSelector(selectDeviceId)
  const transport = useSelector((s) => s.network.transport)
  const dispatch = useDispatch()
  const store = useStore()

  useConnectivity()
  useOutbox()

  useEffect(() => {
    let cursor = loadCursor()
    let fallbackTimer = null
    let pollTimer = null
    let disposed = false

    const saveCursor = () => storage.set(CURSOR_KEY, JSON.stringify(cursor))
    const resync = () => dispatch(baseApi.util.invalidateTags(ALL_TAGS))

    const apply = (evt) => {
      if (!evt || evt.seq <= cursor.seq) return
      if (cursor.epoch && evt.epoch && evt.epoch !== cursor.epoch) {
        // Server restarted — seq numbers reset, refetch everything
        resync()
        cursor = { epoch: evt.epoch, seq: evt.seq }
        saveCursor()
        return
      }
      applyEvent(evt, store)
      cursor = { epoch: evt.epoch ?? cursor.epoch, seq: evt.seq }
      saveCursor()
    }

    const applyBatch = (res) => {
      if (res.resync) {
        resync()
        cursor = { epoch: res.epoch, seq: res.lastSeq }
        saveCursor()
        return
      }
      res.events.forEach(apply)
    }

    // ---- Polling fallback ----
    const poll = async () => {
      try {
        const params = new URLSearchParams({ after: String(cursor.seq), deviceId })
        if (cursor.epoch) params.set('epoch', cursor.epoch)
        const res = await fetch(`${API_ORIGIN}/api/events?${params}`)
        if (!res.ok) throw new Error(String(res.status))
        const body = await res.json()
        applyBatch(body.data)
        dispatch(setTransport('polling'))
      } catch {
        dispatch(setTransport('offline'))
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
    const scheduleFallback = () => {
      if (fallbackTimer || pollTimer) return
      fallbackTimer = setTimeout(() => {
        fallbackTimer = null
        if (!s.connected) startPolling()
      }, FALLBACK_AFTER_MS)
    }

    // ---- Socket ----
    const s = io(API_ORIGIN, {
      auth: { client: 'citizen', deviceId },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 10000,
    })

    s.on('connect', () => {
      clearTimeout(fallbackTimer)
      fallbackTimer = null
      stopPolling()
      dispatch(setTransport('socket'))
    })

    s.on('hello', ({ epoch, lastSeq }) => {
      if (!cursor.epoch || cursor.epoch !== epoch) {
        if (cursor.epoch) resync()
        cursor = { epoch, seq: lastSeq }
        saveCursor()
        return
      }
      // Reconnected to the same server: replay what we missed
      s.emit('sync', { afterSeq: cursor.seq, epoch }, (res) => res && applyBatch(res))
    })

    s.on('evt', apply)

    s.on('disconnect', () => {
      dispatch(setTransport(navigator.onLine ? 'connecting' : 'offline'))
      scheduleFallback()
    })
    s.on('connect_error', () => {
      if (!navigator.onLine) dispatch(setTransport('offline'))
      scheduleFallback()
    })

    scheduleFallback()

    return () => {
      disposed = true
      clearTimeout(fallbackTimer)
      stopPolling()
      s.disconnect()
    }
  }, [deviceId, dispatch, store])

  return (
    <SocketContext.Provider value={{ transport, isConnected: transport === 'socket' }}>
      {children}
    </SocketContext.Provider>
  )
}

export const useSocket = () => {
  const context = useContext(SocketContext)
  if (!context) throw new Error('useSocket must be used within a SocketProvider')
  return context
}

export default SocketContext
