// React
import { useMemo, useState } from 'react'

// Redux
import { useSelector } from 'react-redux'
import {
  selectSummary,
  selectZones,
  selectShelters,
  selectAlerts,
  selectActiveAlerts,
} from '@store/slices/liveSlice'

// i18n
import { useTranslation } from 'react-i18next'

// Components
import {
  Card,
  StatCard,
  ProgressBar,
  EmptyState,
  Icon3D,
  Badge,
  OperationsMap,
  AlertCard,
  TriagePanel,
  ScenarioControl,
} from '@components'

// Constants / utils
import { COLORS, DEFAULT_MAP_LAYERS } from '@constants'
import { formatNumber, formatPercent, occupancyColor, zoneLoadColor } from '@utils'
import { useCan, useThresholds } from '@hooks'

// ============ KPI ROW ============
const KpiRow = () => {
  const { t } = useTranslation()
  const thresholds = useThresholds()
  const s = useSelector(selectSummary)
  if (!s) return null
  const busy = s.brigades.dispatched + s.brigades.on_scene + s.brigades.returning
  const totalBrigades = busy + s.brigades.available
  const rate = s.shelters.occupancyRate
  const rateTone = rate >= thresholds.reroute ? 'critical' : rate >= 0.7 ? 'warning' : 'success'

  return (
    <div className="grid gap-3 grid-cols-[repeat(auto-fit,minmax(170px,1fr))]">
      <StatCard
        icon="sos"
        title={t('kpi.pendingSos')}
        value={s.sos.pending}
        hint={t('kpi.pendingSosHint', { count: s.sos.assigned })}
        tone={s.sos.pending > 0 ? 'critical' : 'neutral'}
      />
      <StatCard
        icon="stopwatch"
        title={t('kpi.lastWindow')}
        value={s.sos.lastWindow}
        hint={t('kpi.lastWindowHint')}
        tone={s.sos.lastWindow >= thresholds.cluster.minSignals ? 'warning' : 'neutral'}
      />
      <StatCard
        icon="siren"
        title={t('kpi.activeAlerts')}
        value={s.alerts.active}
        hint={s.alerts.active ? t('kpi.activeAlertsHint') : t('kpi.noAlertsHint')}
        tone={s.alerts.active ? 'critical' : 'neutral'}
      />
      <StatCard
        icon="fireEngine"
        title={t('kpi.freeBrigades')}
        value={`${s.brigades.available}/${totalBrigades}`}
        hint={t('kpi.freeBrigadesHint', { count: busy })}
        tone={s.brigades.available === 0 ? 'critical' : 'neutral'}
      />
      <StatCard
        icon="stadium"
        title={t('kpi.occupancy')}
        value={formatPercent(rate)}
        hint={t('kpi.occupancyHint', {
          occupancy: formatNumber(s.shelters.occupancy),
          capacity: formatNumber(s.shelters.capacity),
        })}
        tone={rateTone}
      />
      <StatCard
        icon="construction"
        title={t('kpi.closedRoads')}
        value={s.roads.closed}
        hint={t('kpi.closedRoadsHint')}
        tone={s.roads.closed ? 'warning' : 'neutral'}
      />
      <StatCard
        icon="people"
        title={t('kpi.needsHelp')}
        value={s.citizens.needs_help}
        hint={t('kpi.needsHelpHint', { safe: s.citizens.safe, evacuating: s.citizens.evacuating })}
        tone={s.citizens.needs_help ? 'warning' : 'neutral'}
      />
    </div>
  )
}

// ============ MAP ============
const Legend = ({ heatmap }) => {
  const { t } = useTranslation()
  return (
    <div className="absolute left-3 bottom-3 z-[500] bg-panel/95 border border-border rounded-lg px-3 py-2 text-[11px] text-muted space-y-1">
      {[
        [COLORS.success, t('map.legendNormal')],
        [COLORS.warning, t('map.legend70')],
        [COLORS.orange, t('map.legend90')],
        [COLORS.critical, t('map.legend95')],
      ].map(([color, label]) => (
        <div key={label} className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-sm" style={{ backgroundColor: color }} />
          {label}
        </div>
      ))}
      <div className="flex items-center gap-2">
        <span className="w-3 h-3 rounded-full border-2 border-dashed" style={{ borderColor: COLORS.spam }} />
        {t('map.legendSpam')}
      </div>
      {heatmap && (
        <div className="flex items-center gap-2 pt-1 border-t border-border">
          <span className="flex">
            {[COLORS.warning, COLORS.orange, COLORS.critical].map((c) => (
              <span key={c} className="w-2.5 h-3" style={{ backgroundColor: c }} />
            ))}
          </span>
          {t('map.legendHeat')}
        </div>
      )}
    </div>
  )
}

const MapPanel = ({ focus }) => {
  const { t } = useTranslation()
  const [layers, setLayers] = useState(DEFAULT_MAP_LAYERS)
  return (
    <Card padding="none" className="relative overflow-hidden h-[62vh] min-h-[460px]">
      <OperationsMap layers={layers} focus={focus} />
      <div className="absolute right-3 top-3 z-[500] bg-panel/95 border border-border rounded-lg p-2 flex flex-wrap gap-1 max-w-[280px]">
        {Object.keys(DEFAULT_MAP_LAYERS).map((key) => (
          <button
            key={key}
            onClick={() => setLayers((l) => ({ ...l, [key]: !l[key] }))}
            className={`px-2 py-1 rounded-md text-[11px] font-semibold border cursor-pointer ${
              layers[key]
                ? 'bg-panel-3 border-border-strong text-text'
                : 'border-transparent text-subtle hover:text-muted'
            }`}
            aria-pressed={layers[key]}
          >
            {layers[key] ? '● ' : '○ '}
            {t(`map.layers.${key}`)}
          </button>
        ))}
      </div>
      <Legend heatmap={layers.heatmap} />
    </Card>
  )
}

// ============ ZONE LOAD ============
const ZoneLoad = () => {
  const { t } = useTranslation()
  const zones = useSelector(selectZones)
  const sorted = [...zones].sort((a, b) => b.sosActive - a.sosActive)
  const max = Math.max(4, ...zones.map((z) => z.sosActive))
  return (
    <Card>
      <Card.Header title={t('zones.title')} subtitle={t('zones.subtitle')} icon={<Icon3D name="map" size={28} />} />
      <ul className="space-y-3">
        {sorted.map((z) => (
          <li key={z.id}>
            <div className="flex justify-between text-sm mb-1">
              <span className="font-medium">{z.name}</span>
              <span className="tabular-nums text-muted">
                {t('zones.row', { active: z.sosActive, recent: z.sosLastWindow })}
              </span>
            </div>
            <ProgressBar value={z.sosActive / max} color={zoneLoadColor(z.sosActive)} height={8} />
          </li>
        ))}
      </ul>
    </Card>
  )
}

// ============ SHELTER OCCUPANCY ============
const ShelterLoad = () => {
  const { t } = useTranslation()
  const thresholds = useThresholds()
  const shelters = useSelector(selectShelters)
  const active = shelters.filter((s) => s.isActive).sort((a, b) => b.occupancyRate - a.occupancyRate)
  return (
    <Card>
      <Card.Header
        title={t('shelterLoad.title')}
        subtitle={t('shelterLoad.subtitle', { count: active.length, reroute: Math.round(thresholds.reroute * 100) })}
        icon={<Icon3D name="stadium" size={28} />}
      />
      <ul className="space-y-2.5 max-h-[340px] overflow-y-auto pr-1">
        {active.map((s) => (
          <li key={s.id}>
            <div className="flex justify-between gap-2 text-sm mb-1">
              <span className="truncate">{s.name}</span>
              <span className="tabular-nums font-semibold shrink-0" style={{ color: occupancyColor(s.occupancyRate) }}>
                {formatPercent(s.occupancyRate)}
              </span>
            </div>
            <ProgressBar value={s.occupancyRate} color={occupancyColor(s.occupancyRate)} marker={thresholds.reroute} />
            {Number.isFinite(s.fillEtaMin) && s.fillEtaMin > 0 && (
              <p className={`text-[11px] mt-0.5 ${s.fillingFast ? 'text-warning font-semibold' : 'text-subtle'}`}>
                ⏱ {t('map.fillEta', { minutes: Math.round(s.fillEtaMin) })}
                {s.fillingFast && ` · ${t('map.fillingFast')}`}
              </p>
            )}
          </li>
        ))}
      </ul>
    </Card>
  )
}

// ============ ALERT FEED ============
const AlertFeed = ({ onFocus }) => {
  const { t } = useTranslation()
  const active = useSelector(selectActiveAlerts)
  const alerts = useSelector(selectAlerts)
  const fresh = useSelector((state) => state.ui.freshAlerts)
  const recent = useMemo(() => alerts.filter((a) => a.status !== 'active').slice(0, 4), [alerts])

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold flex items-center gap-2">
          <Icon3D name="siren" size={24} /> {t('alert.feedTitle')}
        </h2>
        {active.length > 0 && <Badge variant="solidCritical">{t('alert.feedActive', { count: active.length })}</Badge>}
      </div>

      {active.length === 0 ? (
        <Card>
          <EmptyState icon="safe" title={t('alert.feedEmpty')} description={t('alert.feedEmptyHint')} />
        </Card>
      ) : (
        active.map((a) => <AlertCard key={a.id} alert={a} onFocus={onFocus} fresh={fresh.includes(a.id)} />)
      )}

      {recent.length > 0 && (
        <>
          <p className="text-[11px] uppercase tracking-wide text-muted font-semibold pt-2">
            {t('alert.recentDecisions')}
          </p>
          {recent.map((a) => (
            <AlertCard key={a.id} alert={a} onFocus={onFocus} />
          ))}
        </>
      )}
    </div>
  )
}

// ============ PAGE ============
export const OperationsPage = () => {
  const [focus, setFocus] = useState(null)
  const canSimulate = useCan('simulation:run')
  const canAlerts = useCan('alert:read')
  const canTriage = useCan('sos:read')
  const onFocus = (item) => setFocus({ lat: item.lat, lng: item.lng, at: Date.now() })

  return (
    <div className="p-4 space-y-4">
      {canSimulate && <ScenarioControl />}
      <KpiRow />

      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_440px] gap-4 items-start">
        <div className="space-y-4 min-w-0">
          <MapPanel focus={focus} />
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <ZoneLoad />
            <ShelterLoad />
          </div>
        </div>

        <aside className="space-y-4 min-w-0">
          {canAlerts && <AlertFeed onFocus={onFocus} />}
          {canTriage && <TriagePanel onFocus={onFocus} />}
        </aside>
      </div>
    </div>
  )
}
