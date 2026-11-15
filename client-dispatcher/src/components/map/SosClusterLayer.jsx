import { useEffect, useRef } from 'react'
import { useMap } from 'react-leaflet'
import L from 'leaflet'
import Supercluster from 'supercluster'
import i18n from '@/i18n'

import { SOS_TYPES, COLORS } from '@constants'
import { formatTime } from '@utils'
import { icon3dUrl } from '../ui/Icon3D'
import { sosIcon } from './markers'

/**
 * High-volume SOS layer.
 *
 * Why imperative: rendering one React <Marker>/<Popup> per SOS made the whole
 * map reconcile thousands of components on every realtime event. This layer
 * keeps a plain Leaflet LayerGroup and:
 *
 *   1. clusters SOS with Supercluster (KD-tree, O(log n) per query);
 *      zoomed out → one marker per area: disaster-type 3D icons in the centre
 *      (dominant type largest) + total count pill in the top-right corner;
 *   2. only materialises markers inside the (padded) viewport;
 *   3. diffs markers by key — unchanged clusters/points are never recreated;
 *   4. adds new markers progressively (CHUNK per animation frame), so zooming
 *      into a dense area renders gradually instead of freezing;
 *   5. rebuilds the index at most every REINDEX_MS, however fast data arrives;
 *   6. builds popups lazily on click (no per-marker React tree).
 */
const CLUSTER_MAX_ZOOM = 15 // at map zoom 16 every SOS is shown individually
// Large radius → zoomed out, one marker per area (not a carpet of clusters)
const CLUSTER_RADIUS_PX = 110
const CHUNK = 120
const REINDEX_MS = 400
const TYPE_KEYS = Object.keys(SOS_TYPES)

const escapeHtml = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c])

const clusterSize = (count) => (count < 10 ? 44 : count < 50 ? 52 : count < 200 ? 60 : 68)

/** Cluster marker: type icons centred, count pill top-right. */
const clusterIcon = (count, types, maxPriority) => {
  const ranked = TYPE_KEYS.filter((k) => types[k] > 0).sort((a, b) => types[b] - types[a])
  const dominant = ranked[0] ?? 'general'
  const size = clusterSize(count)
  const ring = SOS_TYPES[dominant]?.color ?? COLORS.critical
  const icons = ranked
    .slice(0, 3)
    .map((k, i) => {
      const px = i === 0 ? Math.round(size * 0.46) : Math.round(size * 0.3)
      return `<img src="${icon3dUrl(SOS_TYPES[k].icon)}" alt="" style="width:${px}px;height:${px}px" />`
    })
    .join('')
  const pill = count > 999 ? '999+' : String(count)
  const urgent = maxPriority >= 40 ? ' sos-cluster-urgent' : ''
  return L.divIcon({
    className: 'map-icon',
    html:
      `<div class="sos-cluster${urgent}" style="--ring:${ring};width:${size}px;height:${size}px">` +
      `<div class="sos-cluster-icons">${icons}</div>` +
      `<span class="sos-cluster-pill">${pill}</span>` +
      `</div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  })
}

const clusterTooltip = (count, types) => {
  const t = i18n.t.bind(i18n)
  const rows = TYPE_KEYS.filter((k) => types[k] > 0)
    .sort((a, b) => types[b] - types[a])
    .map((k) => `${escapeHtml(t(`sosType.${k}`))}: <b>${types[k]}</b>`)
    .join('<br/>')
  return `<b>${escapeHtml(t('map.clusterTitle', { count }))}</b><br/>${rows}<br/><span style="opacity:.7">${escapeHtml(t('map.clusterHint'))}</span>`
}

const sosPopupHtml = (s) => {
  const t = i18n.t.bind(i18n)
  const flags = [
    s.spamFlagged ? t('triage.spam') : null,
    s.queuedOffline ? t('triage.queuedOffline') : null,
    s.citizenSafe ? t('triage.citizenSafe') : null,
  ].filter(Boolean)
  return (
    `<p style="font-weight:600">SOS — ${escapeHtml(t(`sosType.${s.type}`))} · ${escapeHtml(t('triage.priority'))} ${s.priority ?? 0}</p>` +
    `<p style="font-size:12px;color:${COLORS.muted}">${escapeHtml(formatTime(s.createdAt))} · ${escapeHtml(t(`sosStatus.${s.status}`))}</p>` +
    (s.headcount > 1 ? `<p style="font-size:12px">${escapeHtml(t('map.people', { count: s.headcount }))}</p>` : '') +
    (flags.length ? `<p style="font-size:12px;color:${COLORS.warning}">${flags.map(escapeHtml).join(' · ')}</p>` : '') +
    (s.note ? `<p style="font-size:12px;margin-top:4px">${escapeHtml(s.note)}</p>` : '')
  )
}

/** Render the current viewport from the index (diff + progressive add). */
const renderViewport = (st, map) => {
  if (!st.index || !st.group) return
  cancelAnimationFrame(st.raf)

  const zoom = Math.round(map.getZoom())
  const b = map.getBounds().pad(0.25)
  const items = st.index.getClusters([b.getWest(), b.getSouth(), b.getEast(), b.getNorth()], zoom)

  const wanted = new Map()
  for (const f of items) {
    const [lng, lat] = f.geometry.coordinates
    const p = f.properties
    if (p.cluster) {
      const key = `c:${p.cluster_id}:${p.point_count}:${p.maxPriority >= 40 ? 1 : 0}`
      wanted.set(key, { kind: 'cluster', lat, lng, p })
    } else {
      const s = st.byId.get(p.id)
      if (!s) continue
      wanted.set(`p:${s.id}:${s.status}:${s.spamFlagged ? 1 : 0}`, { kind: 'point', lat, lng, s })
    }
  }

  // Remove markers no longer wanted
  for (const [key, marker] of st.markers) {
    if (!wanted.has(key)) {
      st.group.removeLayer(marker)
      st.markers.delete(key)
    }
  }

  // Add new ones progressively (CHUNK per animation frame)
  const toAdd = [...wanted].filter(([key]) => !st.markers.has(key))
  const addChunk = () => {
    if (!st.group) return
    const slice = toAdd.splice(0, CHUNK)
    for (const [key, item] of slice) {
      let marker
      if (item.kind === 'cluster') {
        marker = L.marker([item.lat, item.lng], {
          icon: clusterIcon(item.p.point_count, item.p.types, item.p.maxPriority),
          zIndexOffset: 250,
          keyboard: false,
        })
        marker.bindTooltip(clusterTooltip(item.p.point_count, item.p.types), { direction: 'top', offset: [0, -20] })
        const clusterId = item.p.cluster_id
        marker.on('click', () => {
          const z = Math.min(st.index.getClusterExpansionZoom(clusterId), CLUSTER_MAX_ZOOM + 1)
          map.flyTo([item.lat, item.lng], z, { duration: 0.6 })
        })
      } else {
        const s = item.s
        marker = L.marker([item.lat, item.lng], {
          icon: sosIcon(s),
          zIndexOffset: s.spamFlagged ? 150 : 200,
          keyboard: false,
        })
        marker.bindPopup(() => sosPopupHtml(st.byId.get(s.id) ?? s))
      }
      st.group.addLayer(marker)
      st.markers.set(key, marker)
    }
    if (toAdd.length) st.raf = requestAnimationFrame(addChunk)
  }
  addChunk()
}

/** (Re)build the Supercluster index; types + max priority aggregated per cluster. */
const buildIndex = (st, map, list) => {
  st.byId = new Map(list.map((s) => [s.id, s]))
  const index = new Supercluster({
    radius: CLUSTER_RADIUS_PX,
    maxZoom: CLUSTER_MAX_ZOOM,
    minPoints: 2,
    map: (p) => ({ types: { [p.type]: 1 }, maxPriority: p.priority ?? 0 }),
    reduce: (acc, p) => {
      for (const k in p.types) acc.types[k] = (acc.types[k] ?? 0) + p.types[k]
      acc.maxPriority = Math.max(acc.maxPriority, p.maxPriority)
    },
  })
  index.load(
    list.map((s) => ({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [s.lng, s.lat] },
      properties: { id: s.id, type: s.type, priority: s.spamFlagged ? 0 : s.priority },
    }))
  )
  st.index = index
  st.lastIndexAt = performance.now()
  renderViewport(st, map)
}

export const SosClusterLayer = ({ sos }) => {
  const map = useMap()
  const state = useRef({
    group: null,
    index: null,
    markers: new Map(), // key → L.Marker
    byId: new Map(), // sos id → sos (for lazy popups)
    raf: null,
    reindexTimer: null,
    lastIndexAt: 0,
    pending: null,
  })

  // Layer lifecycle + viewport listeners
  useEffect(() => {
    const st = state.current
    st.group = L.layerGroup().addTo(map)
    const onView = () => renderViewport(st, map)
    map.on('moveend zoomend', onView)
    return () => {
      map.off('moveend zoomend', onView)
      cancelAnimationFrame(st.raf)
      clearTimeout(st.reindexTimer)
      st.reindexTimer = null
      st.group.remove()
      st.group = null
      st.index = null
      st.markers.clear()
    }
  }, [map])

  // Data changes → throttled reindex (at most every REINDEX_MS)
  useEffect(() => {
    const st = state.current
    st.pending = sos
    const since = performance.now() - st.lastIndexAt
    if (since >= REINDEX_MS) {
      buildIndex(st, map, sos)
      st.pending = null
    } else if (!st.reindexTimer) {
      st.reindexTimer = setTimeout(() => {
        st.reindexTimer = null
        if (st.pending && st.group) buildIndex(st, map, st.pending)
        st.pending = null
      }, REINDEX_MS - since)
    }
  }, [sos, map])

  return null
}
