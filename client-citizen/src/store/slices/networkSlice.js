import { createSlice } from '@reduxjs/toolkit'
import { lastUpdatedAt } from '@utils/offlineCache'

/**
 * Connectivity state:
 *   online         — browser reports a network
 *   serverReachable — last API call reached the backend
 *   transport      — realtime channel: connecting | socket | polling | offline
 *   usingCache     — at least one screen shows saved (offline) data
 *   dataUpdatedAt  — when the shown data was last fetched from the server
 */
const networkSlice = createSlice({
  name: 'network',
  initialState: {
    online: typeof navigator === 'undefined' ? true : navigator.onLine,
    serverReachable: true,
    transport: 'connecting',
    usingCache: false,
    dataUpdatedAt: lastUpdatedAt(),
  },
  reducers: {
    setOnline: (state, { payload }) => {
      state.online = payload
      if (!payload) state.serverReachable = false
    },
    serverOk: (state, { payload }) => {
      state.serverReachable = true
      state.usingCache = false
      if (payload?.savedAt) state.dataUpdatedAt = payload.savedAt
    },
    serverUnreachable: (state, { payload }) => {
      state.serverReachable = false
      state.usingCache = Boolean(payload?.fromCache)
      if (payload?.savedAt) state.dataUpdatedAt = payload.savedAt
    },
    setTransport: (state, { payload }) => {
      state.transport = payload
    },
  },
})

export const { setOnline, serverOk, serverUnreachable, setTransport } = networkSlice.actions
export const selectNetwork = (state) => state.network
export const selectIsOffline = (state) => !state.network.online || !state.network.serverReachable
export default networkSlice.reducer
