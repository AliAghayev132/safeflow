import { createSlice, createSelector } from '@reduxjs/toolkit'

const STORAGE_KEY = 'crisis_dispatcher_auth'

const load = () => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

const persist = (state) => {
  try {
    if (state.accessToken) {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          operator: state.operator,
          accessToken: state.accessToken,
          role: state.role,
          permissions: state.permissions,
        })
      )
    } else {
      localStorage.removeItem(STORAGE_KEY)
    }
  } catch {
    // storage unavailable (private mode) — session stays in memory only
  }
}

const saved = load()

/**
 * Staff session. `permissions` come from the server (config/rbac.json) and
 * drive which menu entries, pages and buttons are shown.
 */
const authSlice = createSlice({
  name: 'auth',
  initialState: {
    operator: saved?.operator ?? null,
    accessToken: saved?.accessToken ?? null,
    role: saved?.role ?? saved?.operator?.role ?? null,
    permissions: saved?.permissions ?? [],
  },
  reducers: {
    setCredentials: (state, { payload }) => {
      state.operator = payload.operator
      state.accessToken = payload.accessToken
      state.role = payload.role ?? payload.operator?.role ?? null
      state.permissions = payload.permissions ?? []
      persist(state)
    },
    setSession: (state, { payload }) => {
      state.operator = payload.operator
      state.role = payload.role ?? payload.operator?.role ?? state.role
      state.permissions = payload.permissions ?? state.permissions
      persist(state)
    },
    logout: (state) => {
      state.operator = null
      state.accessToken = null
      state.role = null
      state.permissions = []
      persist(state)
    },
  },
})

export const { setCredentials, setSession, logout } = authSlice.actions
export const selectAuth = (state) => state.auth
export const selectIsAuthenticated = (state) => Boolean(state.auth.accessToken)
export const selectPermissions = (state) => state.auth.permissions
export const selectRole = (state) => state.auth.role
export const selectPermissionSet = createSelector([selectPermissions], (p) => p ?? [])
export default authSlice.reducer
