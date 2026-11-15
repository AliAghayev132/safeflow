// RTK Query
import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react'

import { cacheKeyFor, saveCached, readCached } from '@utils/offlineCache'
import { serverOk, serverUnreachable } from '../slices/networkSlice'

export const API_ORIGIN = (import.meta.env.VITE_API_URL || 'http://localhost:5000').replace(/\/$/, '')

// ============ BASE QUERY ============
// Citizen endpoints are public (device-id based) — no auth header needed.
const rawBaseQuery = fetchBaseQuery({ baseUrl: `${API_ORIGIN}/api`, timeout: 12000 })

const describe = (args) =>
  typeof args === 'string' ? { url: args, params: undefined, method: 'GET' } : { method: 'GET', ...args }

/**
 * - Unwraps `{ success, code, message, data }` into `data`.
 * - Errors carry `{ status, code, message, retryAfter }` (translated by code).
 * - Offline fallback: successful GETs are snapshotted to localStorage; when
 *   the network / server is unreachable the snapshot is served instead and
 *   the app switches to offline mode ("data is from <time>").
 */
const baseQuery = async (args, api, extraOptions) => {
  const { url, params, method } = describe(args)
  const key = method === 'GET' ? cacheKeyFor(url, params) : null

  const result = await rawBaseQuery(args, api, extraOptions)

  if (result.error) {
    const { status, data } = result.error
    const unreachable = status === 'FETCH_ERROR' || status === 'TIMEOUT_ERROR'
    if (unreachable) {
      const cached = key ? readCached(key) : null
      api.dispatch(serverUnreachable({ fromCache: Boolean(cached), savedAt: cached?.savedAt }))
      if (cached) return { data: cached.data, meta: { fromCache: true, savedAt: cached.savedAt, stale: cached.stale } }
    }
    const retryAfter = Number(result.meta?.response?.headers?.get('Retry-After')) || undefined
    return {
      error: {
        status,
        code: data?.code ?? (unreachable ? 'FETCH_ERROR' : undefined),
        message: data?.message,
        retryAfter,
      },
    }
  }

  const payload = result.data?.data ?? null
  if (key) saveCached(key, payload)
  api.dispatch(serverOk(key ? { savedAt: new Date().toISOString() } : undefined))
  return { data: payload, meta: { code: result.data?.code, message: result.data?.message } }
}

// ============ API INSTANCE ============
// Endpoints are injected from feature files (citizenApi, ...).
export const baseApi = createApi({
  reducerPath: 'api',
  baseQuery,
  tagTypes: ['Plan', 'Shelters', 'CitizenState', 'Roads', 'Zones', 'Profile'],
  endpoints: () => ({}),
})

export const ALL_TAGS = ['Plan', 'Shelters', 'CitizenState', 'Roads', 'Zones', 'Profile']
