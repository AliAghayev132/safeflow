import { useCallback, useState } from 'react'
import { useDispatch, useSelector, useStore } from 'react-redux'

import { useSendSosMutation, citizenApi } from '@store/api'
import {
  selectSession,
  setOrigin,
  ticketStarted,
  ticketAccepted,
  ticketQueued,
  ticketFailed,
  enqueue,
  retryLater,
} from '@store/slices'
import { CITY_CENTER, SERVICE_RADIUS_METERS } from '@constants'
import { distanceMeters } from '@utils'
import { useGeolocation } from './useGeolocation'

const NETWORK = ['FETCH_ERROR', 'TIMEOUT_ERROR']

/**
 * One-tap SOS. Never blocks on anything optional:
 *   location: chosen point → district centre → quick GPS → city centre (flagged)
 *   network:  online → POST; offline / failure → outbox (auto-retry)
 * Every SOS gets its own clientId (idempotency key).
 */
export const useSendSos = () => {
  const dispatch = useDispatch()
  const store = useStore()
  const { deviceId } = useSelector(selectSession)
  const [sendSos] = useSendSosMutation()
  const { locate } = useGeolocation()
  const [sendingType, setSendingType] = useState(null)

  const resolveCoords = useCallback(async () => {
    const { origin, zoneCode } = store.getState().session
    if (origin) return { coords: origin, approx: false }

    const zones = citizenApi.endpoints.getZones.select()(store.getState()).data ?? []
    const zone = zones.find((z) => z.code === zoneCode)
    if (zone) return { coords: zone.center, approx: false }

    const gps = await locate({ timeout: 5000, silent: true })
    if (gps && distanceMeters(gps, CITY_CENTER) <= SERVICE_RADIUS_METERS) {
      dispatch(setOrigin({ ...gps, source: 'gps' }))
      return { coords: gps, approx: false }
    }
    return { coords: CITY_CENTER, approx: true }
  }, [store, locate, dispatch])

  const send = useCallback(
    async (type, details = {}) => {
      if (sendingType) return { status: 'busy' }
      setSendingType(type)
      try {
        const clientId = crypto.randomUUID()
        const sentAt = new Date().toISOString()
        const { coords, approx } = await resolveCoords()
        const payload = {
          clientId,
          deviceId,
          type,
          lat: coords.lat,
          lng: coords.lng,
          clientCreatedAt: sentAt,
          ...details,
          ...(approx ? { note: [details.note, 'location_unknown'].filter(Boolean).join(' · ') } : {}),
        }
        const offline = !navigator.onLine
        dispatch(ticketStarted({ clientId, type, sentAt, queued: offline, approxLocation: approx }))

        if (offline) {
          dispatch(enqueue({ ...payload, queuedOffline: true }))
          return { status: 'queued', approx }
        }

        try {
          const res = await sendSos(payload).unwrap()
          dispatch(ticketAccepted(res.sos))
          return { status: res.duplicate ? 'duplicate' : 'sent', approx }
        } catch (error) {
          if (NETWORK.includes(error.status) || error.status === 429) {
            dispatch(enqueue({ ...payload, queuedOffline: NETWORK.includes(error.status) }))
            if (error.status === 429) {
              dispatch(retryLater({ clientId, delayMs: (error.retryAfter ?? 30) * 1000 }))
            }
            dispatch(ticketQueued())
            return { status: 'queued', approx }
          }
          dispatch(ticketFailed())
          return { status: 'error', error }
        }
      } finally {
        setSendingType(null)
      }
    },
    [sendingType, resolveCoords, deviceId, dispatch, sendSos]
  )

  return { send, sendingType }
}
