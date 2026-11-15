import { useCallback, useEffect, useRef } from 'react'
import { useDispatch, useStore } from 'react-redux'

import { citizenApi } from '@store/api'
import { dequeue, retryLater, ticketAccepted, ticketFailed } from '@store/slices/sosSlice'

const NETWORK = ['FETCH_ERROR', 'TIMEOUT_ERROR']
const backoff = (attempts) => Math.min(60000, 2000 * 2 ** attempts)

/**
 * Sends SOS that were queued while offline. Runs on `online`, every few
 * seconds while items are waiting, and with exponential backoff on failure.
 * The clientId makes every retry idempotent on the server.
 */
export const useOutbox = () => {
  const dispatch = useDispatch()
  const store = useStore()
  const busy = useRef(false)

  const flush = useCallback(async () => {
    if (busy.current || !navigator.onLine) return
    busy.current = true
    try {
      const now = Date.now()
      const due = store.getState().sos.outbox.filter((o) => o.nextAttemptAt <= now)
      for (const item of due) {
        const req = dispatch(citizenApi.endpoints.sendSos.initiate(item.payload))
        try {
          const res = await req.unwrap()
          dispatch(dequeue(item.payload.clientId))
          const active = store.getState().sos.active
          if (active?.clientId === item.payload.clientId) dispatch(ticketAccepted(res.sos))
        } catch (error) {
          if (NETWORK.includes(error.status)) {
            dispatch(retryLater({ clientId: item.payload.clientId, delayMs: backoff(item.attempts) }))
            break // still offline — stop this round
          }
          if (error.status === 429) {
            dispatch(retryLater({ clientId: item.payload.clientId, delayMs: (error.retryAfter ?? 30) * 1000 }))
            continue
          }
          // Validation error — the payload can never succeed
          dispatch(dequeue(item.payload.clientId))
          if (store.getState().sos.active?.clientId === item.payload.clientId) dispatch(ticketFailed())
        } finally {
          req.reset?.()
        }
      }
    } finally {
      busy.current = false
    }
  }, [dispatch, store])

  useEffect(() => {
    window.addEventListener('online', flush)
    const timer = setInterval(() => {
      if (store.getState().sos.outbox.length) flush()
    }, 3000)
    flush()
    return () => {
      window.removeEventListener('online', flush)
      clearInterval(timer)
    }
  }, [flush, store])

  return flush
}
