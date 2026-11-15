import { memo, useDeferredValue, useEffect, useMemo } from 'react'
import { useSelector } from 'react-redux'
import { useTranslation } from 'react-i18next'
import {
  MapContainer,
  TileLayer,
  Polygon,
  Polyline,
  Marker,
  Popup,
  Tooltip,
  Circle,
  useMap,
  useMapEvents,
} from 'react-leaflet'
import {
  selectZones,
  selectShelters,
  selectBrigades,
  selectOpenSos,
  selectActiveAlerts,
  selectRoadEdges,
} from '@store/slices/liveSlice'
import {
  MAP_CENTER,
  MAP_ZOOM,
  COLORS,
  BRIGADE_STATUS,
  SHELTER_LEVEL,
  DEFAULT_MAP_LAYERS,
} from '@constants'
import { zoneLoadColor, occupancyColor, formatPercent, formatNumber, shelterLevelKey } from '@utils'
import { useThresholds } from '@hooks'
import { ProgressBar } from '../ui/ProgressBar'
import { StatusBadge } from '../ui/StatusBadge'
import { DensityLayer } from './DensityLayer'
import { SosClusterLayer } from './SosClusterLayer'
import { shelterIcon, brigadeIcon, alertPulseIcon, pickedPointIcon } from './markers'

/*
 * Performance notes
 * -----------------
 * Every layer below is its own memoised component with its own selector, so a
 * realtime SOS batch re-renders only the SOS / density layers — roads (157
 * polylines), zones, shelters and brigades are untouched. SOS are drawn by the
 * imperative, clustered SosClusterLayer (see that file).
 */

const roadStyle = (edge) => {
  if (edge.status === 'closed') {
    return { color: COLORS.critical, weight: 5, opacity: 1, dashArray: '8 6' }
  }
  if (edge.congestion >= 0.85) return { color: COLORS.orange, weight: 4, opacity: 0.95 }
  if (edge.congestion >= 0.5) return { color: COLORS.warning, weight: 3.5, opacity: 0.9 }
  if (edge.congestion > 0) return { color: COLORS.warning, weight: 3, opacity: 0.55 }
  return { color: COLORS.road, weight: 2, opacity: 0.8 }
}

const ClickHandler = ({ onMapClick }) => {
  useMapEvents({
    click: (e) => onMapClick?.({ lat: e.latlng.lat, lng: e.latlng.lng }),
  })
  return null
}

const FlyTo = ({ focus }) => {
  const map = useMap()
  useEffect(() => {
    if (focus) map.flyTo([focus.lat, focus.lng], Math.max(map.getZoom(), 15), { duration: 0.8 })
  }, [focus, map])
  return null
}

// ============ LAYERS ============

const ZonesLayer = memo(function ZonesLayer({ dimmed, interactive }) {
  const { t } = useTranslation()
  const zones = useSelector(selectZones)
  return zones.map((zone) => {
    const color = zoneLoadColor(zone.sosActive)
    return (
      <Polygon
        key={zone.id}
        positions={zone.polygon}
        pathOptions={{
          color,
          weight: 1.5,
          dashArray: '4 6',
          fillColor: color,
          fillOpacity: dimmed ? 0 : zone.sosActive ? 0.14 : 0.03,
        }}
        interactive={interactive}
      >
        <Tooltip sticky>
          {t('map.zoneTooltip', { name: zone.name, active: zone.sosActive, recent: zone.sosLastWindow })}
        </Tooltip>
      </Polygon>
    )
  })
})

const RoadsLayer = memo(function RoadsLayer() {
  const { t } = useTranslation()
  const edges = useSelector(selectRoadEdges)
  // Draw normal roads first, disrupted ones on top
  const sorted = useMemo(
    () =>
      [...edges].sort(
        (a, b) =>
          (a.status === 'closed') - (b.status === 'closed') || (a.congestion ?? 0) - (b.congestion ?? 0)
      ),
    [edges]
  )
  return sorted.map((edge) =>
    edge.path ? (
      <Polyline
        key={edge.edgeId}
        positions={edge.path}
        pathOptions={roadStyle(edge)}
        interactive={edge.status === 'closed' || edge.congestion > 0}
      >
        {(edge.status === 'closed' || edge.congestion > 0) && (
          <Tooltip sticky>
            {edge.name} —{' '}
            {edge.status === 'closed'
              ? `${t('map.roadClosed')}${edge.closedReason ? ` (${edge.closedReason})` : ''}`
              : t('map.roadCongestion', { value: Math.round(edge.congestion * 100) })}
          </Tooltip>
        )}
      </Polyline>
    ) : null
  )
})

const AlertsLayer = memo(function AlertsLayer() {
  const alerts = useSelector(selectActiveAlerts)
  return alerts.map((alert) => (
    <Marker
      key={`alert-${alert.id}`}
      position={[alert.lat, alert.lng]}
      icon={alertPulseIcon()}
      interactive={false}
      zIndexOffset={-1000}
    />
  ))
})

const ShelterMarker = memo(function ShelterMarker({ s, thresholds, reserveLabel }) {
  const { t } = useTranslation()
  const levelKey = shelterLevelKey(s, thresholds)
  return (
    <Marker position={[s.lat, s.lng]} icon={shelterIcon(s, { reserve: reserveLabel })} zIndexOffset={100}>
      <Popup>
        <div className="min-w-56">
          <p className="font-semibold">{s.name}</p>
          <p className="text-xs" style={{ color: COLORS.muted }}>
            {t(`shelterType.${s.type}`)} · {s.address}
          </p>
          <div className="mt-2 flex justify-between text-xs">
            <span>
              {formatNumber(s.occupancy)} / {formatNumber(s.capacity)}
            </span>
            <strong style={{ color: occupancyColor(s.occupancyRate) }}>{formatPercent(s.occupancyRate)}</strong>
          </div>
          <ProgressBar
            value={s.occupancyRate}
            color={occupancyColor(s.occupancyRate)}
            marker={thresholds.reroute}
            className="mt-1"
          />
          <div className="mt-2">
            <StatusBadge
              size="sm"
              meta={SHELTER_LEVEL[levelKey]}
              label={t(`shelterLevel.${levelKey}`, {
                reroute: Math.round(thresholds.reroute * 100),
                alert: Math.round(thresholds.alert * 100),
              })}
            />
          </div>
          {s.isActive && s.inflowPerMin > 0 && <p className="text-xs mt-1.5">{t('map.inflow', { value: s.inflowPerMin })}</p>}
          {s.isActive && Number.isFinite(s.fillEtaMin) && (
            <p className="text-xs mt-1 font-semibold" style={{ color: s.fillingFast ? COLORS.warning : COLORS.muted }}>
              ⏱ {t('map.fillEta', { minutes: Math.round(s.fillEtaMin) })}
              {s.fillingFast && ` · ${t('map.fillingFast')}`}
            </p>
          )}
          {!s.isActive && (
            <p className="text-xs mt-2" style={{ color: COLORS.warning }}>
              {t('map.reserveClosed')}
            </p>
          )}
        </div>
      </Popup>
    </Marker>
  )
})

const SheltersLayer = memo(function SheltersLayer() {
  const { t } = useTranslation()
  const thresholds = useThresholds()
  const shelters = useSelector(selectShelters)
  const reserveLabel = t('shelterLevel.inactive').split('·')[0].trim().toUpperCase()
  return shelters.map((s) => <ShelterMarker key={s.id} s={s} thresholds={thresholds} reserveLabel={reserveLabel} />)
})

const BrigadeMarker = memo(function BrigadeMarker({ b }) {
  const { t } = useTranslation()
  return (
    <Marker position={[b.lat, b.lng]} icon={brigadeIcon(b)} zIndexOffset={300}>
      <Popup>
        <p className="font-semibold">{b.name}</p>
        <p className="text-xs" style={{ color: COLORS.muted }}>
          {t(`brigadeType.${b.type}`)} · {t('map.members', { count: b.members })}
        </p>
        <div className="mt-1.5">
          <StatusBadge size="sm" meta={BRIGADE_STATUS[b.status]} label={t(`brigadeStatus.${b.status}`)} />
        </div>
      </Popup>
    </Marker>
  )
})

const BrigadesLayer = memo(function BrigadesLayer() {
  const brigades = useSelector(selectBrigades)
  return brigades.map((b) => <BrigadeMarker key={b.id} b={b} />)
})

/** SOS: clustered imperative layer (+ optional density grid). */
const SosLayers = memo(function SosLayers({ showSos, showHeat }) {
  const sos = useSelector(selectOpenSos)
  // Let React keep the UI responsive while a big batch is being processed
  const deferred = useDeferredValue(sos)
  return (
    <>
      {showHeat && <DensityLayer sos={deferred} />}
      {showSos && <SosClusterLayer sos={deferred} />}
    </>
  )
})

// ============ MAP ============

/**
 * Live operations map: zones, road network state, shelters (fill-time
 * warnings), brigades, clustered SOS (spam visually distinct), SOS density
 * layer and active alert locations. All data comes from the live Redux slice.
 */
export const OperationsMap = ({
  layers: layerOverrides,
  onMapClick,
  pickedPoint,
  pickedRadius,
  focus,
  className = 'h-full w-full',
}) => {
  const layers = { ...DEFAULT_MAP_LAYERS, ...layerOverrides }

  return (
    <MapContainer
      center={MAP_CENTER}
      zoom={MAP_ZOOM}
      className={className}
      minZoom={11}
      maxZoom={16}
      preferCanvas
    >
      <TileLayer
        url="https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}"
        attribution="Tiles &copy; Esri"
        maxZoom={16}
      />
      <TileLayer
        url="https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Reference/MapServer/tile/{z}/{y}/{x}"
        maxZoom={16}
      />
      {onMapClick && <ClickHandler onMapClick={onMapClick} />}
      <FlyTo focus={focus} />

      {layers.zones && <ZonesLayer dimmed={layers.heatmap} interactive={!onMapClick} />}
      {layers.roads && <RoadsLayer />}
      {layers.alerts && <AlertsLayer />}
      {layers.shelters && <SheltersLayer />}
      <SosLayers showSos={layers.sos} showHeat={layers.heatmap} />
      {layers.brigades && <BrigadesLayer />}

      {pickedPoint && (
        <>
          {pickedRadius && (
            <Circle
              center={[pickedPoint.lat, pickedPoint.lng]}
              radius={pickedRadius}
              pathOptions={{ color: COLORS.info, weight: 2, fillColor: COLORS.info, fillOpacity: 0.1 }}
              interactive={false}
            />
          )}
          <Marker
            position={[pickedPoint.lat, pickedPoint.lng]}
            icon={pickedPointIcon()}
            interactive={false}
            zIndexOffset={1000}
          />
        </>
      )}
    </MapContainer>
  )
}
