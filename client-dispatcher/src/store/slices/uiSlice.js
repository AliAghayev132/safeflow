import { createSlice, nanoid } from '@reduxjs/toolkit'

const MUTE_KEY = 'crisis_dispatcher_muted'

const loadMuted = () => {
  try {
    return localStorage.getItem(MUTE_KEY) === '1'
  } catch {
    return false
  }
}

/**
 * Transient UI state: toasts (translation keys + params), the "new critical
 * alert" banner queue, sound, realtime connection mode and sequence cursor.
 */
const uiSlice = createSlice({
  name: 'ui',
  initialState: {
    toasts: [],
    incomingAlerts: [], // alert ids not yet acknowledged by the operator
    freshAlerts: [], // ids that should flash in the feed
    muted: loadMuted(),
    // 'connecting' | 'live' | 'polling' | 'offline'
    connection: 'connecting',
    realtime: { epoch: null, seq: 0 },
  },
  reducers: {
    toastAdded: {
      reducer: (state, { payload }) => {
        state.toasts.push(payload)
        if (state.toasts.length > 4) state.toasts.shift()
      },
      // `message` is either a translation key (with params) or a ready string
      prepare: (type, message, params) => ({ payload: { id: nanoid(), type, message, params } }),
    },
    toastDismissed: (state, { payload }) => {
      state.toasts = state.toasts.filter((t) => t.id !== payload)
    },
    alertIncoming: (state, { payload }) => {
      if (!state.incomingAlerts.includes(payload)) state.incomingAlerts.push(payload)
      if (!state.freshAlerts.includes(payload)) state.freshAlerts.push(payload)
    },
    alertAcknowledged: (state, { payload }) => {
      state.incomingAlerts = state.incomingAlerts.filter((id) => id !== payload)
    },
    allAlertsAcknowledged: (state) => {
      state.incomingAlerts = []
    },
    alertFreshCleared: (state, { payload }) => {
      state.freshAlerts = state.freshAlerts.filter((id) => id !== payload)
    },
    muteToggled: (state) => {
      state.muted = !state.muted
      try {
        localStorage.setItem(MUTE_KEY, state.muted ? '1' : '0')
      } catch {
        // ignore
      }
    },
    connectionChanged: (state, { payload }) => {
      state.connection = payload
    },
    realtimeCursor: (state, { payload }) => {
      state.realtime = payload
    },
  },
})

export const {
  toastAdded,
  toastDismissed,
  alertIncoming,
  alertAcknowledged,
  allAlertsAcknowledged,
  alertFreshCleared,
  muteToggled,
  connectionChanged,
  realtimeCursor,
} = uiSlice.actions

/** Toast helpers — pass a translation key (+ params) or a translated string. */
export const toast = {
  success: (message, params) => toastAdded('success', message, params),
  error: (message, params) => toastAdded('error', message, params),
  info: (message, params) => toastAdded('info', message, params),
}

export default uiSlice.reducer
