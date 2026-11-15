import { useEffect } from 'react'
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
  SOS_STATUS,
  SHELTER_TYPES,
  BRIGADE_TYPES,
  BRIGADE_STATUS,
  SHELTER_LEVEL,
  DEFAULT_MAP_LAYERS,
} from '@constants'
import {
  zoneLoadColor,
  occupancyColor,
  formatPercent,
  formatTime,
  formatNumber,
  shelterLevelKey,
} from '@utils'
import { useThresholds } from '@hooks'
import { ProgressBar } from '../ui/ProgressBar'
import { StatusBadge } from '../ui/StatusBadge'
import { DensityLayer } from './DensityLayer'
import { shelterIcon, brigadeIcon, sosIcon, alertPulseIcon, pickedPointIcon } from './markers'

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

/**
 * Live operations map: zones, road network state, shelters (fill-time
 * warnings), brigades, SOS (spam visually distinct), SOS density layer and
 * active alert locations. All data comes from the live Redux slice.
 */
export const OperationsMap = ({
  layers: layerOverrides,
  onMapClick,
  pickedPoint,
  pickedRadius,
  focus,
  className = 'h-full w-full',
}) => {
  const { t } = useTranslation()
  const thresholds = useThresholds()
  const layers = { ...DEFAULT_MAP_LAYERS, ...layerOverrides }
  const zones = useSelector(selectZones)
  const shelters = useSelector(selectShelters)
  const brigades = useSelector(selectBrigades)
  const sos = useSelector(selectOpenSos)
  const alerts = useSelector(selectActiveAlerts)
  const edges = useSelector(selectRoadEdges)
  const reserveLabel = t('shelterLevel.inactive').split('·')[0].trim().toUpperCase()

  // Draw normal roads first, disrupted ones on top
  const sortedEdges = [...edges].sort(
    (a, b) =>
      (a.status === 'closed') - (b.status === 'closed') || (a.congestion ?? 0) - (b.congestion ?? 0)
  )

  return (
    <MapContainer center={MAP_CENTER} zoom={MAP_ZOOM} className={className} minZoom={11} maxZoom={16}>
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

      {layers.zones &&
        zones.map((zone) => {
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
                fillOpacity: layers.heatmap ? 0 : zone.sosActive ? 0.14 : 0.03,
              }}
              interactive={!onMapClick}
            >
              <Tooltip sticky>
                {t('map.zoneTooltip', { name: zone.name, active: zone.sosActive, recent: zone.sosLastWindow })}
              </Tooltip>
            </Polygon>
          )
        })}

      {layers.heatmap && <DensityLayer sos={sos} />}

      {layers.roads &&
        sortedEdges.map((edge) =>
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
        )}

      {layers.alerts &&
        alerts.map((alert) => (
          <Marker
            key={`alert-${alert.id}`}
            position={[alert.lat, alert.lng]}
            icon={alertPulseIcon()}
            interactive={false}
            zIndexOffset={-1000}
          />
        ))}

      {layers.shelters &&
        shelters.map((s) => {
          const levelKey = shelterLevelKey(s, thresholds)
          return (
            <Marker
              key={s.id}
              position={[s.lat, s.lng]}
              icon={shelterIcon(s, { reserve: reserveLabel })}
              zIndexOffset={100}
            >
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
                    <strong style={{ color: occupancyColor(s.occupancyRate) }}>
                      {formatPercent(s.occupancyRate)}
                    </strong>
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
                  {s.isActive && s.inflowPerMin > 0 && (
                    <p className="text-xs mt-1.5">{t('map.inflow', { value: s.inflowPerMin })}</p>
                  )}
                  {s.isActive && Number.isFinite(s.fillEtaMin) && (
                    <p
                      className="text-xs mt-1 font-semibold"
                      style={{ color: s.fillingFast ? COLORS.warning : COLORS.muted }}
                    >
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
        })}

      {layers.sos &&
        sos.map((s) => (
          <Marker
            key={s.id}
            position={[s.lat, s.lng]}
            icon={sosIcon(s)}
            zIndexOffset={s.spamFlagged ? 150 : 200}
          >
            <Popup>
              <p className="font-semibold">
                SOS — {t(`sosType.${s.type}`)} · {t('triage.priority')} {s.priority}
              </p>
              <p className="text-xs" style={{ color: COLORS.muted }}>
                {formatTime(s.createdAt)}
              </p>
              <div className="mt-1.5 flex flex-wrap gap-1">
                <StatusBadge size="sm" meta={SOS_STATUS[s.status]} label={t(`sosStatus.${s.status}`)} />
                {s.spamFlagged && (
                  <StatusBadge size="sm" meta={{ variant: 'neutral' }} label={t('triage.spam')} />
                )}
              </div>
              {s.note && <p className="text-xs mt-1">{s.note}</p>}
            </Popup>
          </Marker>
        ))}

      {layers.brigades &&
        brigades.map((b) => (
          <Marker key={b.id} position={[b.lat, b.lng]} icon={brigadeIcon(b)} zIndexOffset={300}>
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
        ))}

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
