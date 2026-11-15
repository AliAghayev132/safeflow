import { createSlice, createSelector } from '@reduxjs/toolkit'
import { getDeviceId, storage } from '@utils'

const STORAGE_KEY = 'crisis.session'

const loadPersisted = () => {
  try {
    const raw = storage.get(STORAGE_KEY)
    if (!raw) return {}
    const { origin, originSource, zoneCode, accessibleRoute } = JSON.parse(raw)
    return {
      origin: origin ?? null,
      originSource: originSource ?? null,
      zoneCode: zoneCode ?? null,
      accessibleRoute: Boolean(accessibleRoute),
    }
  } catch {
    return {}
  }
}

let lastPersisted = ''
export const persistSession = ({ origin, originSource, zoneCode, accessibleRoute }) => {
  const next = JSON.stringify({ origin, originSource, zoneCode, accessibleRoute })
  if (next === lastPersisted) return
  lastPersisted = next
  storage.set(STORAGE_KEY, next)
}

const initialState = {
  deviceId: getDeviceId(),
  // { lat, lng } chosen by GPS or map tap; null when a district is used
  origin: null,
  originSource: null, // 'gps' | 'map' | 'zone'
  zoneCode: null,
  // Last automatic reroute pushed by the server (shown as a banner)
  rerouteNotice: null,
  ...loadPersisted(),
}

const round = (v) => Math.round(v * 1e5) / 1e5

const sessionSlice = createSlice({
  name: 'session',
  initialState,
  reducers: {
    setOrigin: (state, { payload: { lat, lng, source } }) => {
      state.origin = { lat: round(lat), lng: round(lng) }
      state.originSource = source
      state.zoneCode = null
    },
    setZone: (state, { payload: code }) => {
      state.zoneCode = code
      state.origin = null
      state.originSource = code ? 'zone' : null
    },
    clearLocation: (state) => {
      state.origin = null
      state.originSource = null
      state.zoneCode = null
    },
    /** Barrier-free route (wheelchair / stretcher) for this device. */
    setAccessibleRoute: (state, { payload }) => {
      state.accessibleRoute = Boolean(payload)
    },
    showRerouteNotice: (state, { payload }) => {
      state.rerouteNotice = payload
    },
    dismissRerouteNotice: (state) => {
      state.rerouteNotice = null
    },
  },
})

export const { setOrigin, setZone, clearLocation, setAccessibleRoute, showRerouteNotice, dismissRerouteNotice } =
  sessionSlice.actions

// ============ SELECTORS ============
export const selectSession = (state) => state.session
export const selectDeviceId = (state) => state.session.deviceId

/**
 * Query args for the evacuation plan. Memoized so RTK Query sees a stable
 * object; the same args are used by socket handlers to patch the cache.
 */
export const selectPlanArgs = createSelector(
  [(s) => s.session.origin, (s) => s.session.zoneCode, (s) => s.session.deviceId, (s) => s.session.accessibleRoute],
  (origin, zoneCode, deviceId, accessibleRoute) => {
    const mode = accessibleRoute ? { mode: 'accessible' } : {}
    if (origin) return { lat: origin.lat, lng: origin.lng, deviceId, ...mode }
    if (zoneCode) return { zone: zoneCode, deviceId, ...mode }
    return null
  }
)

export default sessionSlice.reducer
