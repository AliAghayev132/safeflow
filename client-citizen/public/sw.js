/*
 * Citizen app service worker — keeps the app usable offline.
 *
 *  - App shell & assets (same origin): network-first, falling back to cache,
 *    so online users always get fresh code and offline users still open the
 *    app (navigations fall back to the cached index.html).
 *  - Map tiles: cache-first with a size cap (last viewed area stays visible).
 *  - API calls are NOT cached here — the app keeps its own data snapshot
 *    (localStorage) and SOS outbox, which show "data is from <time>".
 */
const SHELL_CACHE = 'crisis-shell-v1'
const TILE_CACHE = 'crisis-tiles-v1'
const MAX_TILES = 400
const SHELL = ['/', '/index.html', '/favicon.svg', '/manifest.webmanifest']

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(SHELL_CACHE)
      .then((cache) => cache.addAll(SHELL).catch(() => null))
      .then(() => self.skipWaiting())
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => ![SHELL_CACHE, TILE_CACHE].includes(k)).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  )
})

const trimCache = async (name, max) => {
  const cache = await caches.open(name)
  const keys = await cache.keys()
  if (keys.length > max) await Promise.all(keys.slice(0, keys.length - max).map((k) => cache.delete(k)))
}

const networkFirst = async (request) => {
  const cache = await caches.open(SHELL_CACHE)
  try {
    const response = await fetch(request)
    if (response.ok && response.type === 'basic') cache.put(request, response.clone())
    return response
  } catch {
    const cached = await cache.match(request, { ignoreSearch: request.mode === 'navigate' })
    if (cached) return cached
    if (request.mode === 'navigate') {
      const shell = (await cache.match('/index.html')) || (await cache.match('/'))
      if (shell) return shell
    }
    return new Response('', { status: 503, statusText: 'Offline' })
  }
}

const tileCacheFirst = async (request) => {
  const cache = await caches.open(TILE_CACHE)
  const cached = await cache.match(request)
  if (cached) return cached
  try {
    const response = await fetch(request)
    if (response.ok || response.type === 'opaque') {
      cache.put(request, response.clone())
      trimCache(TILE_CACHE, MAX_TILES)
    }
    return response
  } catch {
    return new Response('', { status: 503 })
  }
}

self.addEventListener('fetch', (event) => {
  const { request } = event
  if (request.method !== 'GET') return
  const url = new URL(request.url)

  if (url.hostname === 'server.arcgisonline.com') {
    event.respondWith(tileCacheFirst(request))
    return
  }
  if (url.origin !== self.location.origin) return
  if (url.pathname.startsWith('/api') || url.pathname.startsWith('/socket.io')) return
  // Vite dev internals (HMR client) must never be served stale
  if (url.pathname.startsWith('/@vite') || url.searchParams.has('t')) return

  event.respondWith(networkFirst(request))
})
