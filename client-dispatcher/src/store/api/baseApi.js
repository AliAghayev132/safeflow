// RTK Query
import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react'
import { errorText } from '@utils/format'

export const API_ORIGIN = import.meta.env.VITE_API_URL || 'http://localhost:5000'

// ============ BASE QUERY ============
const baseQuery = fetchBaseQuery({
  baseUrl: `${API_ORIGIN}/api`,
  prepareHeaders: (headers, { getState }) => {
    const token = getState().auth?.accessToken
    if (token && !headers.get('Authorization')) {
      headers.set('Authorization', `Bearer ${token}`)
    }
    return headers
  },
})

// ============ AUTH + RATE LIMIT WRAPPER ============
// Staff tokens are long-lived; on a 401 the session is simply ended.
// 429 responses carry Retry-After — exposed on the error for the UI.
const baseQueryWithAuth = async (args, api, extraOptions) => {
  const result = await baseQuery(args, api, extraOptions)
  const url = typeof args === 'string' ? args : args.url
  if (result?.error?.status === 401 && !url.startsWith('/auth/login')) {
    api.dispatch({ type: 'auth/logout' })
  }
  if (result?.error?.status === 429) {
    const retryAfter = Number(result.meta?.response?.headers?.get('Retry-After'))
    if (Number.isFinite(retryAfter)) result.error.retryAfter = retryAfter
  }
  return result
}

export const ALL_TAGS = [
  'Overview',
  'RoutingOutage',
  'Roads',
  'Rules',
  'Queue',
  'MyBrigade',
  'Config',
  'Audit',
  'Roles',
  'Operators',
  'System',
  'Scenarios',
  'Alerts',
  'Features',
]

// ============ API INSTANCE ============
// Endpoints are injected from feature files (authApi, dispatcherApi, ...).
// Feature modules add their own tag types with
//   baseApi.enhanceEndpoints({ addTagTypes: [...] }).injectEndpoints(...)
export const baseApi = createApi({
  reducerPath: 'api',
  baseQuery: baseQueryWithAuth,
  tagTypes: ALL_TAGS,
  endpoints: () => ({}),
})

/** Translated, user-facing message for an RTK Query error. */
export const apiErrorMessage = (error, fallbackKey) => errorText(error, fallbackKey)
