// Redux Toolkit
import { configureStore } from '@reduxjs/toolkit'

// API
import { baseApi } from './api/baseApi'

// Slices
import sessionReducer, { persistSession } from './slices/sessionSlice'
import networkReducer from './slices/networkSlice'
import sosReducer, { persistSos } from './slices/sosSlice'

// ============ STORE ============
export const store = configureStore({
  reducer: {
    // RTK Query cache reducer (backed by the offline snapshot, see baseApi)
    [baseApi.reducerPath]: baseApi.reducer,
    // Device id, chosen location / district, reroute notice
    session: sessionReducer,
    // Online / offline / realtime transport
    network: networkReducer,
    // Live SOS ticket + offline outbox
    sos: sosReducer,
  },
  middleware: (getDefaultMiddleware) => getDefaultMiddleware().concat(baseApi.middleware),
})

// Persist location, live ticket and outbox across reloads / offline
store.subscribe(() => {
  const state = store.getState()
  persistSession(state.session)
  persistSos(state.sos)
})
