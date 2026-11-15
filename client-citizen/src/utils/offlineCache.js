import { storage } from './deviceId'

/**
 * Persistent snapshot of read endpoints (localStorage), used when the network
 * or the server is unavailable. Only whitelisted citizen GETs are stored:
 * zones, shelters (name, type, coords, capacity, last occupancy), the last
 * evacuation plans (recommended routes), roads, own state and profile.
 */
const PREFIX = 'crisis.cache:'
const META_KEY = 'crisis.cache.meta'
const MAX_PLANS = 5

const CACHEABLE = ['/citizen/zones', '/citizen/shelters', '/citizen/evacuation', '/citizen/roads', '/citizen/state', '/citizen/profile']

export const cacheKeyFor = (url, params) => {
  const path = url.split('?')[0]
  if (!CACHEABLE.includes(path)) return null
  const p = params ? JSON.stringify(Object.keys(params).sort().map((k) => [k, params[k]])) : ''
  return `${path}${p}`
}

const readMeta = () => {
  try {
    return JSON.parse(storage.get(META_KEY) ?? '{}')
  } catch {
    return {}
  }
}

export const saveCached = (key, data) => {
  const savedAt = new Date().toISOString()
  try {
    storage.set(PREFIX + key, JSON.stringify({ data, savedAt }))
    const meta = readMeta()
    meta.lastUpdatedAt = savedAt
    if (key.startsWith('/citizen/evacuation')) {
      meta.plans = [key, ...(meta.plans ?? []).filter((k) => k !== key)].slice(0, MAX_PLANS)
      for (const old of (readMeta().plans ?? []).filter((k) => !meta.plans.includes(k))) {
        localStorage.removeItem(PREFIX + old)
      }
    }
    storage.set(META_KEY, JSON.stringify(meta))
  } catch {
    // quota exceeded / storage disabled — offline mode just has less data
  }
}

export const readCached = (key) => {
  try {
    const exact = storage.get(PREFIX + key)
    if (exact) return JSON.parse(exact)
    // Evacuation plan for a different point: fall back to the latest plan
    if (key.startsWith('/citizen/evacuation')) {
      const latest = readMeta().plans?.[0]
      const raw = latest ? storage.get(PREFIX + latest) : null
      if (raw) return { ...JSON.parse(raw), stale: true }
    }
  } catch {
    // corrupted entry
  }
  return null
}

export const lastUpdatedAt = () => readMeta().lastUpdatedAt ?? null
