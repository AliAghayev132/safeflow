// React
import { useState } from 'react'

// Redux
import { useSelector } from 'react-redux'
import { selectZones, selectShelters, selectClosedRoads } from '@store/slices/liveSlice'
import {
  useCloseRandomRoadMutation,
  useOpenRoadMutation,
  useSimulateTrafficMutation,
  useSetShelterOccupancyMutation,
  useSosWaveMutation,
  useResetSimulationMutation,
  useGetRulesQuery,
} from '@store/api'
import { useAction } from '@store/hooks'

// i18n
import { useTranslation } from 'react-i18next'

// Components
import {
  Card,
  Button,
  Select,
  Icon3D,
  OperationsMap,
  EmptyState,
  ScenarioControl,
  StatusBadge,
} from '@components'

// Constants / utils
import { SOS_TYPE_KEYS } from '@constants'
import { formatPercent, formatTime, occupancyColor } from '@utils'
import { useCan, useThresholds } from '@hooks'
import { CircleCheck, Ban } from 'lucide-react'

const Range = ({ label, value, display, ...props }) => (
  <label className="flex flex-col gap-1.5">
    <span className="flex justify-between text-xs font-medium text-muted">
      {label}
      <strong className="text-text tabular-nums">{display ?? value}</strong>
    </span>
    <input type="range" value={value} className="w-full" {...props} />
  </label>
)

// ============ SOS WAVE ============
const SosWaveCard = ({ center, setCenter, radius, setRadius }) => {
  const { t } = useTranslation()
  const { cluster } = useThresholds()
  const zones = useSelector(selectZones)
  const run = useAction()
  const [sosWave, { isLoading }] = useSosWaveMutation()
  const [zoneId, setZoneId] = useState('')
  const [count, setCount] = useState(5)
  const [type, setType] = useState('collapse')

  const onZone = (e) => {
    setZoneId(e.target.value)
    const zone = zones.find((z) => z.id === e.target.value)
    if (zone) setCenter(zone.center)
  }

  const submit = () =>
    run(sosWave({ lat: center.lat, lng: center.lng, count, type, radiusMeters: radius }), 'toast.sosWave', { count })

  return (
    <Card>
      <Card.Header
        title={t('simulation.waveTitle')}
        subtitle={t('simulation.waveSubtitle', {
          min: cluster.minSignals,
          window: Math.round(cluster.windowMs / 60000),
        })}
        icon={<Icon3D name="sos" size={30} />}
      />
      <div className="space-y-3">
        <Select
          id="wave-zone"
          label={t('simulation.center')}
          value={zoneId}
          onChange={onZone}
          options={[
            { value: '', label: t('simulation.centerPick') },
            ...zones.map((z) => ({ value: z.id, label: t('simulation.centerZone', { name: z.name }) })),
          ]}
        />
        <p className="text-xs text-muted tabular-nums">
          {center
            ? t('simulation.centerSelected', { lat: center.lat.toFixed(5), lng: center.lng.toFixed(5) })
            : t('simulation.centerNone')}
        </p>
        <Select
          id="wave-type"
          label={t('simulation.hazard')}
          value={type}
          onChange={(e) => setType(e.target.value)}
          options={SOS_TYPE_KEYS.map((value) => ({ value, label: t(`sosType.${value}`) }))}
        />
        <Range label={t('simulation.count')} min={1} max={20} value={count} onChange={(e) => setCount(Number(e.target.value))} />
        <Range
          label={t('simulation.radius')}
          min={50}
          max={1000}
          step={50}
          value={radius}
          display={`${radius} m`}
          onChange={(e) => setRadius(Number(e.target.value))}
        />
        <Button variant="critical" fullWidth disabled={!center} loading={isLoading} onClick={submit}>
          {t('simulation.sendWave')}
        </Button>
      </div>
    </Card>
  )
}

// ============ ROADS ============
const RoadsCard = () => {
  const { t } = useTranslation()
  const closed = useSelector(selectClosedRoads)
  const run = useAction()
  const [closeRandom, { isLoading: closing }] = useCloseRandomRoadMutation()
  const [openRoad, { isLoading: opening, originalArgs }] = useOpenRoadMutation()
  const [traffic, { isLoading: trafficLoading }] = useSimulateTrafficMutation()
  const [share, setShare] = useState(0.25)

  return (
    <Card>
      <Card.Header
        title={t('simulation.roadsTitle')}
        subtitle={t('simulation.roadsSubtitle')}
        icon={<Icon3D name="construction" size={30} />}
      />
      <div className="space-y-3">
        <Button variant="warning" fullWidth loading={closing} onClick={() => run(closeRandom(), 'toast.roadClosed')}>
          {t('simulation.closeRandom')}
        </Button>
        <Range
          label={t('simulation.trafficShare')}
          min={0}
          max={0.6}
          step={0.05}
          value={share}
          display={formatPercent(share)}
          onChange={(e) => setShare(Number(e.target.value))}
        />
        <Button variant="secondary" fullWidth loading={trafficLoading} onClick={() => run(traffic(share), 'toast.traffic')}>
          {t('simulation.traffic')}
        </Button>

        <div className="pt-2 border-t border-border">
          <p className="text-xs font-semibold text-muted mb-2">{t('simulation.closedRoads', { count: closed.length })}</p>
          {closed.length === 0 ? (
            <p className="text-xs text-subtle">{t('simulation.noClosed')}</p>
          ) : (
            <ul className="space-y-1.5 max-h-40 overflow-y-auto">
              {closed.map((e) => (
                <li key={e.edgeId} className="flex items-center gap-2 text-sm">
                  <span className="w-2 h-2 rounded-full bg-critical shrink-0" />
                  <span className="flex-1 truncate">
                    {e.name} <span className="text-xs text-subtle font-mono">{e.edgeId}</span>
                  </span>
                  <Button
                    size="sm"
                    variant="ghost"
                    loading={opening && originalArgs === e.edgeId}
                    onClick={() => run(openRoad(e.edgeId), 'toast.roadOpened')}
                  >
                    {t('simulation.open')}
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </Card>
  )
}

// ============ SHELTER OCCUPANCY ============
const ShelterOccupancyCard = () => {
  const { t } = useTranslation()
  const thresholds = useThresholds()
  const shelters = useSelector(selectShelters)
  const run = useAction()
  const [setOccupancy, { isLoading }] = useSetShelterOccupancyMutation()
  const [shelterId, setShelterId] = useState('')
  const [rate, setRate] = useState(0.5)

  const selected = shelters.find((s) => s.id === shelterId) ?? null

  const onSelect = (e) => {
    setShelterId(e.target.value)
    const s = shelters.find((x) => x.id === e.target.value)
    if (s) setRate(Number(s.occupancyRate.toFixed(2)))
  }

  const apply = (value) =>
    run(setOccupancy({ id: shelterId, rate: value }), 'toast.occupancy', {
      name: selected.name,
      value: formatPercent(value),
    })

  const presets = [thresholds.reroute + 0.01, thresholds.alert + 0.01, 0.4]

  return (
    <Card>
      <Card.Header
        title={t('simulation.occupancyTitle')}
        subtitle={t('simulation.occupancySubtitle', {
          reroute: Math.round(thresholds.reroute * 100),
          alert: Math.round(thresholds.alert * 100),
        })}
        icon={<Icon3D name="stadium" size={30} />}
      />
      <div className="space-y-3">
        <Select
          id="occ-shelter"
          label={t('simulation.shelter')}
          value={shelterId}
          onChange={onSelect}
          options={[
            { value: '', label: t('simulation.shelterPick') },
            ...shelters
              .filter((s) => s.isActive)
              .map((s) => ({ value: s.id, label: `${s.name} — ${formatPercent(s.occupancyRate)}` })),
          ]}
        />
        {selected && (
          <>
            <Range
              label={t('simulation.newOccupancy')}
              min={0}
              max={1}
              step={0.01}
              value={rate}
              display={<span style={{ color: occupancyColor(rate) }}>{formatPercent(rate)}</span>}
              onChange={(e) => setRate(Number(e.target.value))}
            />
            <div className="grid grid-cols-3 gap-2">
              {presets.map((p) => (
                <Button key={p} size="sm" variant="secondary" onClick={() => setRate(Number(p.toFixed(2)))}>
                  {formatPercent(p)}
                </Button>
              ))}
            </div>
            <Button fullWidth loading={isLoading} onClick={() => apply(rate)}>
              {t('simulation.applyOccupancy')}
            </Button>
          </>
        )}
      </div>
    </Card>
  )
}

// ============ RULES ============
const RulesCard = () => {
  const { t } = useTranslation()
  const canRead = useCan('rules:read')
  const { cluster, reroute, alert } = useThresholds()
  const { data: rules = [], isLoading } = useGetRulesQuery(undefined, { pollingInterval: 10000, skip: !canRead })
  if (!canRead) return null

  const params = {
    min: cluster.minSignals,
    radius: cluster.radiusMeters,
    window: Math.round(cluster.windowMs / 60000),
    cooldown: Math.round((cluster.cooldownMs ?? 0) / 60000),
    reroute: Math.round(reroute * 100),
    alert: Math.round(alert * 100),
  }

  return (
    <Card>
      <Card.Header
        title={t('simulation.rulesTitle')}
        subtitle={t('simulation.rulesSubtitle')}
        icon={<Icon3D name="gear" size={30} />}
      />
      {isLoading ? (
        <p className="text-sm text-muted">{t('app.loading')}</p>
      ) : rules.length === 0 ? (
        <EmptyState icon="gear" title={t('simulation.rulesEmpty')} />
      ) : (
        <ul className="grid grid-cols-1 lg:grid-cols-3 gap-3">
          {rules.map((r) => (
            <li key={r.id} className="bg-panel-2 border border-border rounded-lg p-3">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-semibold">{t(`rules.${r.id}.name`, { defaultValue: r.id })}</p>
                <StatusBadge
                  size="sm"
                  meta={r.enabled ? { variant: 'success', Icon: CircleCheck } : { variant: 'neutral', Icon: Ban }}
                  label={r.enabled ? t('simulation.ruleEnabled') : t('simulation.ruleDisabled')}
                />
              </div>
              <p className="text-xs text-muted mt-1.5 leading-relaxed">
                {t(`rules.${r.id}.description`, { ...params, defaultValue: r.description })}
              </p>
              <p className="text-[11px] text-subtle mt-2 font-mono">
                {t('simulation.ruleRuns', { id: r.id, runs: r.runs, time: formatTime(r.lastRunAt) })}
              </p>
              {r.lastError && <p className="text-xs text-critical mt-1">{r.lastError}</p>}
            </li>
          ))}
        </ul>
      )}
    </Card>
  )
}

// ============ PAGE ============
export const SimulationPage = () => {
  const { t } = useTranslation()
  const run = useAction()
  const [reset, { isLoading: resetting }] = useResetSimulationMutation()
  const [center, setCenter] = useState(null)
  const [radius, setRadius] = useState(300)

  const onReset = () => {
    if (window.confirm(t('simulation.resetConfirm'))) {
      run(reset(), 'toast.simulationReset')
    }
  }

  return (
    <div className="p-4 space-y-4">
      <ScenarioControl />
      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_380px] gap-4 items-start">
        <div className="space-y-4 min-w-0">
          <Card padding="none" className="relative overflow-hidden h-[62vh] min-h-[460px]">
            <OperationsMap onMapClick={setCenter} pickedPoint={center} pickedRadius={radius} layers={{ heatmap: true }} />
            <div className="absolute left-3 top-3 z-[500] bg-panel/95 border border-border rounded-lg px-3 py-2 text-xs text-muted flex items-center gap-2">
              <Icon3D name="pin" size={18} /> {t('map.pickHint')}
            </div>
          </Card>
          <RulesCard />
        </div>

        <aside className="space-y-4 min-w-0">
          <SosWaveCard center={center} setCenter={setCenter} radius={radius} setRadius={setRadius} />
          <ShelterOccupancyCard />
          <RoadsCard />
          <Card>
            <Card.Header
              title={t('simulation.resetTitle')}
              subtitle={t('simulation.resetSubtitle')}
              icon={<Icon3D name="hourglass" size={30} />}
            />
            <Button
              variant="outline"
              fullWidth
              loading={resetting}
              onClick={onReset}
              className="border-critical text-critical hover:bg-critical-soft"
            >
              {t('simulation.reset')}
            </Button>
          </Card>
        </aside>
      </div>
    </div>
  )
}
