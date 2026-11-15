import { useEffect, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { MapContainer, TileLayer, Marker, Polyline, Tooltip, useMap, useMapEvents } from 'react-leaflet'
import { clsx } from 'clsx'

import { CITY_CENTER, CITY_ZOOM } from '@constants'
import { formatPercent } from '@utils'
import { shelterIcon, userIcon } from './markers'

// Esri light gray canvas (no API key) — calm basemap so routes stand out
const TILE_URL =
  'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}'
const LABELS_URL =
  'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Reference/MapServer/tile/{z}/{y}/{x}'
const TILE_ATTRIBUTION = 'Tiles &copy; Esri'

/** Fits the view to the active route (or the user) whenever it changes. */
const FitView = ({ route, origin }) => {
  const map = useMap()
  const key = route?.path?.map((p) => p.join(',')).join('|') ?? ''

  useEffect(() => {
    if (route?.path?.length > 1) {
      map.fitBounds(route.path, { padding: [40, 40], maxZoom: 16 })
    } else if (origin) {
      map.setView([origin.lat, origin.lng], 15)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, origin?.lat, origin?.lng])

  return null
}

const ClickToPick = ({ onPick }) => {
  useMapEvents({
    click: (e) => onPick?.({ lat: e.latlng.lat, lng: e.latlng.lng }),
  })
  return null
}

/**
 * Citizen evacuation map: user position, active shelters (3D icons with
 * occupancy), recommended route, closed and congested roads. An approximate
 * (straight-line fallback) route is drawn dashed.
 */
export const EvacuationMap = ({ origin, shelters = [], recommended, edges = [], onPick, onSelectShelter, className }) => {
  const { t } = useTranslation()
  const closed = useMemo(() => edges.filter((e) => e.status === 'closed'), [edges])
  const congested = useMemo(() => edges.filter((e) => e.status === 'open' && e.congestion >= 0.6), [edges])
  const route = recommended?.route
  const targetId = recommended?.shelter?.id
  const dashed = route?.approximate ? '10 10' : undefined

  return (
    <div className={clsx('relative overflow-hidden', className)}>
      <MapContainer
        center={[CITY_CENTER.lat, CITY_CENTER.lng]}
        zoom={CITY_ZOOM}
        maxZoom={16}
        zoomControl={false}
        className="h-full w-full"
        attributionControl
      >
        <TileLayer url={TILE_URL} attribution={TILE_ATTRIBUTION} maxZoom={16} />
        <TileLayer url={LABELS_URL} maxZoom={16} />
        <FitView route={route} origin={origin} />
        {onPick && <ClickToPick onPick={onPick} />}

        {congested.map((e) => (
          <Polyline key={`c-${e.edgeId}`} positions={e.path} pathOptions={{ color: '#d97706', weight: 4, opacity: 0.85 }} />
        ))}

        {route?.path?.length > 1 && (
          <>
            <Polyline positions={route.path} pathOptions={{ color: '#ffffff', weight: 10, opacity: 1 }} />
            <Polyline positions={route.path} pathOptions={{ color: '#12305a', weight: 6, opacity: 1, dashArray: dashed }} />
          </>
        )}

        {closed.map((e) => (
          <Polyline
            key={`x-${e.edgeId}`}
            positions={e.path}
            pathOptions={{ color: '#c8102e', weight: 6, dashArray: '6 8', opacity: 1 }}
          >
            <Tooltip sticky>{t('evacuation.closedRoad', { name: e.name })}</Tooltip>
          </Polyline>
        ))}

        {shelters.map((s) => (
          <Marker
            key={s.id}
            position={[s.lat, s.lng]}
            icon={shelterIcon(s, { highlighted: s.id === targetId })}
            zIndexOffset={s.id === targetId ? 1000 : 0}
            eventHandlers={{ click: () => onSelectShelter?.(s) }}
          >
            <Tooltip direction="top" offset={[0, -24]}>
              <strong>{s.name}</strong>
              <br />
              {t('evacuation.tooltipOccupancy', {
                percent: formatPercent(s.occupancyRate),
                occupancy: s.occupancy,
                capacity: s.capacity,
              })}
            </Tooltip>
          </Marker>
        ))}

        {origin && (
          <Marker position={[origin.lat, origin.lng]} icon={userIcon()} zIndexOffset={2000}>
            <Tooltip direction="top" offset={[0, -10]}>
              {t('evacuation.you')}
            </Tooltip>
          </Marker>
        )}
      </MapContainer>

      <div className="pointer-events-none absolute bottom-2 left-2 z-[400] flex flex-wrap gap-1.5 text-[11px] font-semibold">
        <span className="rounded-md bg-surface px-2 py-1 text-ink shadow-sm">
          <span className="mr-1 inline-block h-1.5 w-4 rounded bg-brand align-middle" /> {t('evacuation.legendRoute')}
        </span>
        <span className="rounded-md bg-surface px-2 py-1 text-ink shadow-sm">
          <span className="mr-1 inline-block h-1.5 w-4 rounded bg-sos align-middle" /> {t('evacuation.legendClosed')}
        </span>
        <span className="rounded-md bg-surface px-2 py-1 text-ink shadow-sm">
          <span className="mr-1 inline-block h-1.5 w-4 rounded bg-[#d97706] align-middle" /> {t('evacuation.legendCongestion')}
        </span>
      </div>
    </div>
  )
}
