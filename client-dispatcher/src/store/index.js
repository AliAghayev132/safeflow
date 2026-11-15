// Redux Toolkit
import { configureStore } from '@reduxjs/toolkit'

// API
import { baseApi } from './api/baseApi'

// Slices
import authReducer from './slices/authSlice'
import liveReducer from './slices/liveSlice'
import uiReducer from './slices/uiSlice'

// ============ STORE ============
export const store = configureStore({
  reducer: {
    // RTK Query cache reducer
    [baseApi.reducerPath]: baseApi.reducer,
    // Operator session (localStorage-backed)
    auth: authReducer,
    // Live operational picture (socket-driven)
    live: liveReducer,
    // Toasts, alert banner, sound
    ui: uiReducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      // Large live payloads — skip dev-only deep checks for speed
      immutableCheck: false,
      serializableCheck: false,
    }).concat(baseApi.middleware),
})
