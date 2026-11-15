import { useTranslation } from 'react-i18next'
import { MapContainer, TileLayer, Marker, Tooltip, Polyline } from 'react-leaflet'
import L from 'leaflet'

import { Table, StatCard, StatusBadge, Icon3D, Card, EmptyState, PageLoader } from '@components'
import { icon3dUrl } from '@components/ui/Icon3D'
import { MAP_CENTER, COLORS } from '@constants'
import { formatAgo } from '@utils'
import { useNow } from '@hooks'

import { useGetFleetQuery } from '../../api'
import { useDroneLive, DRONE_POLL_MS } from '../../useDroneLive'
import { DRONE_STATUS } from '../../constants'
import { Battery } from '../../components'

const droneIcon = (status) => {
  const color = DRONE_STATUS[status]?.variant === 'warning' ? COLORS.warning : status === 'idle' ? COLORS.success : COLORS.info
  return L.divIcon({
    className: 'map-icon',
    html: `<div class="marker-badge" style="--marker-color:${color};width:34px;height:34px"><img src="${icon3dUrl('helicopter')}" style="width:22px;height:22px" alt="" /></div>`,
    iconSize: [34, 34],
    iconAnchor: [17, 17],
  })
}

/**
 * Drone fleet (Resources): live status (icon + text + colour), battery,
 * payload and position, with a small fleet map.
 */
export const DronesPage = () => {
  const { t } = useTranslation()
  useDroneLive()
  const now = useNow(15000)
  const { data, isLoading } = useGetFleetQuery(undefined, { pollingInterval: DRONE_POLL_MS })
  const drones = data?.drones ?? []

  if (isLoading) return <PageLoader />

  const count = (s) => drones.filter((d) => d.status === s).length
  const avgBattery = drones.length ? Math.round(drones.reduce((a, d) => a + d.batteryPct, 0) / drones.length) : 0

  return (
    <div className="p-5 space-y-4">
      <div className="grid gap-3 grid-cols-[repeat(auto-fit,minmax(180px,1fr))]">
        <StatCard icon="helicopter" title={t('drones.status.idle')} value={count('idle')} tone={count('idle') ? 'success' : 'critical'} />
        <StatCard icon="compass" title={t('drones.status.en_route')} value={count('en_route') + count('loading')} />
        <StatCard icon="antenna" title={t('drones.status.returning')} value={count('returning')} />
        <StatCard icon="gear" title={t('drones.status.charging')} value={count('charging')} />
        <StatCard icon="chart" title={t('drones.avgBattery')} value={`${avgBattery}%`} />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_420px] gap-4 items-start">
        {drones.length === 0 ? (
          <Card>
            <EmptyState icon="helicopter" title={t('drones.emptyFleet')} />
          </Card>
        ) : (
          <Table>
            <Table.Head>
              <tr>
                {['drone', 'status', 'battery', 'payload', 'speed', 'position'].map((c) => (
                  <Table.Th key={c}>{t(`drones.columns.${c}`)}</Table.Th>
                ))}
              </tr>
            </Table.Head>
            <tbody>
              {drones.map((d) => (
                <Table.Row key={d.id}>
                  <Table.Td>
                    <div className="flex items-center gap-3">
                      <Icon3D name="helicopter" size={30} />
                      <div>
                        <p className="font-medium">{d.name}</p>
                        <p className="text-xs text-muted font-mono">{d.code}</p>
                      </div>
                    </div>
                  </Table.Td>
                  <Table.Td>
                    <StatusBadge meta={DRONE_STATUS[d.status]} label={t(`drones.status.${d.status}`)} />
                    <p className="text-[11px] text-subtle mt-1">{formatAgo(d.statusChangedAt, now)}</p>
                  </Table.Td>
                  <Table.Td>
                    <Battery pct={d.batteryPct} />
                  </Table.Td>
                  <Table.Td className="tabular-nums">
                    {d.loadKg ? `${d.loadKg} / ` : ''}
                    {d.payloadKg} kg
                  </Table.Td>
                  <Table.Td className="tabular-nums text-muted">{d.speedKmh} km/h</Table.Td>
                  <Table.Td className="tabular-nums text-xs text-muted font-mono">
                    {d.lat.toFixed(4)}, {d.lng.toFixed(4)}
                  </Table.Td>
                </Table.Row>
              ))}
            </tbody>
          </Table>
        )}

        <Card padding="none" className="overflow-hidden h-[420px] xl:sticky xl:top-4">
          <MapContainer center={MAP_CENTER} zoom={12} className="h-full w-full" maxZoom={16} minZoom={11}>
            <TileLayer
              url="https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}"
              attribution="Tiles &copy; Esri"
              maxZoom={16}
            />
            {drones
              .filter((d) => d.target)
              .map((d) => (
                <Polyline
                  key={`p-${d.id}`}
                  positions={[
                    [d.lat, d.lng],
                    [d.target.lat, d.target.lng],
                  ]}
                  pathOptions={{ color: COLORS.warning, weight: 2, dashArray: '4 6' }}
                />
              ))}
            {drones.map((d) => (
              <Marker key={d.id} position={[d.lat, d.lng]} icon={droneIcon(d.status)}>
                <Tooltip direction="top">
                  {d.name} · {t(`drones.status.${d.status}`)} · {Math.round(d.batteryPct)}%
                </Tooltip>
              </Marker>
            ))}
          </MapContainer>
        </Card>
      </div>
    </div>
  )
}
