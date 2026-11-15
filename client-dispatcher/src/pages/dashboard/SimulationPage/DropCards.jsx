import { useTranslation } from 'react-i18next'
import { clsx } from 'clsx'
import { ShieldAlert, Zap, CircleCheck, OctagonX, Clock, RefreshCw } from 'lucide-react'
import { Card, Button, Icon3D, Badge, StatusBadge } from '@components'
import { useSosFloodMutation, useGetRoutingOutageQuery, useSetRoutingOutageMutation } from '@store/api/simulationApi'
import { useAction } from '@store/hooks'

const Row = ({ label, value, tone = 'text-text' }) => (
  <div className="flex items-center justify-between gap-3 py-1.5 text-sm">
    <span className="text-muted">{label}</span>
    <strong className={clsx('tabular-nums', tone)}>{value}</strong>
  </div>
)

/**
 * Challenge Drop #3 — SOS flood / spam attack: 600 fake SOS from a botnet
 * (3 IPs, repeat taps, device-id rotation, replays) + 20 genuine citizens at
 * the same time, against the real HTTP endpoint. Shows what every protection
 * layer did and the server's average response time.
 */
export const FloodAttackCard = () => {
  const { t } = useTranslation()
  const run = useAction()
  const [flood, { data: rep, isLoading }] = useSosFloodMutation()

  return (
    <Card>
      <Card.Header
        title={t('drops.flood.title')}
        subtitle={t('drops.flood.subtitle')}
        icon={<ShieldAlert className="h-7 w-7 text-critical" />}
      />
      <Button
        variant="critical"
        fullWidth
        loading={isLoading}
        onClick={() => run(flood({ attack: 600, genuine: 20 }), 'drops.flood.done')}
        leftIcon={<Zap className="h-4 w-4" />}
      >
        {isLoading ? t('drops.flood.running') : t('drops.flood.start')}
      </Button>

      {rep && (
        <div className="mt-4 space-y-3">
          <div
            className={clsx(
              'rounded-xl border-2 p-3 text-center',
              rep.latency.avgUnderTarget ? 'border-success bg-success-soft' : 'border-critical bg-critical-soft'
            )}
          >
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">{t('drops.flood.avgLatency')}</p>
            <p className={clsx('text-3xl font-extrabold tabular-nums', rep.latency.avgUnderTarget ? 'text-success' : 'text-critical')}>
              {rep.latency.avgMs} ms
            </p>
            <p className="text-xs text-muted">
              {t('drops.flood.target')} · p95 {rep.latency.p95Ms} ms · {rep.requests} {t('drops.flood.requests')}
            </p>
          </div>

          <div className="divide-y divide-border rounded-xl border border-border px-3">
            <Row label={t('drops.flood.sent')} value={rep.attack.sent} />
            <Row label={t('drops.flood.rateLimited')} value={rep.attack.rateLimited} tone="text-warning" />
            <Row label={t('drops.flood.duplicates')} value={rep.attack.duplicatesMerged} tone="text-info" />
            <Row label={t('drops.flood.spamFlagged')} value={rep.attack.spamFlagged} tone="text-warning" />
            <Row label={t('drops.flood.hidden')} value={rep.attack.hiddenFromDispatcher} tone="text-success" />
          </div>

          <StatusBadge
            meta={
              rep.genuine.accepted === rep.genuine.sent
                ? { variant: 'success', Icon: CircleCheck }
                : { variant: 'critical', Icon: OctagonX }
            }
            label={t('drops.flood.genuine', { accepted: rep.genuine.accepted, sent: rep.genuine.sent })}
          />
          {rep.errors === 0 && (
            <StatusBadge meta={{ variant: 'success', Icon: CircleCheck }} label={t('drops.flood.noErrors')} />
          )}
        </div>
      )}
    </Card>
  )
}

const MODES = [
  { mode: 'ok', Icon: CircleCheck, variant: 'secondary' },
  { mode: '503', Icon: OctagonX, variant: 'critical' },
  { mode: 'timeout', Icon: Clock, variant: 'warning' },
]

const BREAKER_META = {
  closed: { variant: 'success', Icon: CircleCheck },
  open: { variant: 'critical', Icon: OctagonX },
  'half-open': { variant: 'warning', Icon: RefreshCw },
}

/**
 * Challenge Drop #2 — the external map / routing API goes down (HTTP 503 or
 * > 5 s). Routing continues from the local road graph; citizens see
 * "Offline / Backup routing mode". Shows the circuit-breaker state.
 */
export const RoutingOutageCard = () => {
  const { t } = useTranslation()
  const run = useAction()
  const { data: routing } = useGetRoutingOutageQuery(undefined, { pollingInterval: 3000 })
  const [setMode, { isLoading }] = useSetRoutingOutageMutation()
  const ext = routing?.external
  const current = ext?.simulatorMode ?? 'ok'
  const breaker = ext?.breaker?.state ?? 'closed'

  return (
    <Card>
      <Card.Header
        title={t('drops.outage.title')}
        subtitle={t('drops.outage.subtitle')}
        icon={<Icon3D name="map" size={30} />}
      />
      {ext && !ext.simulated && <p className="mb-2 text-xs text-muted">{t('drops.outage.realApi')}</p>}
      <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label={t('drops.outage.title')}>
        {MODES.map(({ mode, Icon }) => (
          <button
            key={mode}
            type="button"
            role="radio"
            aria-checked={current === mode}
            disabled={isLoading || !ext?.simulated}
            onClick={() => run(setMode(mode), `drops.outage.set.${mode}`)}
            className={clsx(
              'flex flex-col items-center gap-1 rounded-lg border px-2 py-2.5 text-xs font-semibold transition-colors cursor-pointer disabled:cursor-not-allowed disabled:opacity-50',
              current === mode
                ? mode === 'ok'
                  ? 'border-success bg-success-soft text-success'
                  : 'border-critical bg-critical-soft text-critical'
                : 'border-border bg-panel-2 text-muted hover:text-text'
            )}
          >
            <Icon className="h-4 w-4" aria-hidden />
            {t(`drops.outage.mode.${mode}`)}
          </button>
        ))}
      </div>

      <div className="mt-3 divide-y divide-border rounded-xl border border-border px-3">
        <div className="flex items-center justify-between py-2 text-sm">
          <span className="text-muted">{t('drops.outage.breaker')}</span>
          <StatusBadge size="sm" meta={BREAKER_META[breaker]} label={t(`drops.outage.breakerState.${breaker}`)} />
        </div>
        <Row label={t('drops.outage.failures')} value={ext?.breaker?.failures ?? 0} />
        <Row label={t('drops.outage.chain')} value={(routing?.providers ?? []).join(' → ')} />
      </div>
      {current !== 'ok' && (
        <p className="mt-3 flex items-start gap-2 rounded-lg bg-warning-soft px-3 py-2 text-xs font-semibold text-warning">
          <Badge size="sm" variant="warning">{t('drops.outage.citizenSees')}</Badge>
          {t('drops.outage.notice')}
        </p>
      )}
    </Card>
  )
}
