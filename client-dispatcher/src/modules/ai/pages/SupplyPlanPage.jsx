import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { clsx } from 'clsx'
import { RefreshCw, Send, Check } from 'lucide-react'

import { Card, StatCard, Button, Icon3D, PageLoader, EmptyState, Badge, Table, useConfirm } from '@components'
import { useAction } from '@store/hooks'
import { useFeature } from '@hooks'
import { formatTime } from '@utils'
import { useGetSupplyPlanQuery, useRefreshSupplyPlanMutation, useApplySupplyPlanMutation } from '../api'
import { useAiLive, AI_POLL_MS } from '../shared'

const KINDS = ['water', 'food', 'medicine', 'first_aid']

/**
 * AI resource distribution: deficits per assembly point (forecast × ratios
 * − stock − requested), priority, drone delivery schedule; one click turns
 * selected rows into supply requests (drones module).
 */
export const SupplyPlanPage = () => {
  const { t } = useTranslation()
  useAiLive()
  const run = useAction()
  const confirm = useConfirm()
  const dronesOn = useFeature('drones')
  const { data: plan, isLoading } = useGetSupplyPlanQuery(undefined, { pollingInterval: AI_POLL_MS })
  const [refresh, { isLoading: refreshing }] = useRefreshSupplyPlanMutation()
  const [apply, { isLoading: applying }] = useApplySupplyPlanMutation()
  const [picked, setPicked] = useState([])

  if (isLoading) return <PageLoader />
  if (!plan) return <EmptyState icon="tent" title={t('app.loadFailed')} />

  const rows = plan.shelters
  const withDeficit = rows.filter((r) => r.deficitKg > 0)
  const toggle = (id) => setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]))
  const onApply = async () => {
    const ids = picked.length ? picked : withDeficit.map((r) => r.shelterId)
    const ok = await confirm({ title: t('ai.supply.applyTitle'), message: t('ai.supply.applyConfirm', { count: ids.length }), confirmLabel: t('ai.supply.apply') })
    if (ok && (await run(apply(ids), 'ai.supply.applied'))) setPicked([])
  }

  return (
    <div className="space-y-4 p-4">
      <Card className="flex flex-wrap items-center gap-3">
        <Icon3D name="tent" size={38} />
        <div className="min-w-60 flex-1">
          <h2 className="font-semibold">{t('ai.supply.title')}</h2>
          <p className="text-xs text-muted">{t('ai.supply.subtitle', { min: plan.horizonMin, fleet: plan.fleet })}</p>
        </div>
        <Button size="sm" variant="secondary" loading={refreshing} onClick={() => run(refresh())} leftIcon={<RefreshCw className="h-4 w-4" />}>
          {t('ai.refresh')}
        </Button>
        <Button size="sm" variant="critical" disabled={!dronesOn || !withDeficit.length} loading={applying} onClick={onApply} leftIcon={<Send className="h-4 w-4" />}>
          {picked.length ? t('ai.supply.applySelected', { count: picked.length }) : t('ai.supply.applyAll')}
        </Button>
      </Card>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard icon="tent" title={t('ai.supply.deficit')} value={`${plan.totals.deficitKg} kg`} />
        <StatCard icon="siren" tone={plan.totals.critical ? 'critical' : 'neutral'} title={t('ai.supply.critical')} value={plan.totals.critical} />
        <StatCard icon="helicopter" title={t('ai.supply.trips')} value={plan.totals.trips} hint={plan.totals.unscheduledKg ? t('ai.supply.unscheduled', { kg: plan.totals.unscheduledKg }) : undefined} />
        <StatCard icon="stopwatch" title={t('ai.supply.lastEta')} value={`${plan.totals.lastEtaMin} ${t('ai.min')}`} />
      </div>

      <Card padding="none">
        <Table className="rounded-none border-0">
          <Table.Head>
            <tr>
              <Table.Th className="w-10"><span className="sr-only">{t('ai.supply.select')}</span></Table.Th>
              <Table.Th>{t('ai.supply.col.shelter')}</Table.Th>
              <Table.Th>{t('ai.supply.col.people')}</Table.Th>
              <Table.Th>{t('ai.supply.col.coverage')}</Table.Th>
              {KINDS.map((k) => (
                <Table.Th key={k}>{t(`drones.kind.${k}`)}</Table.Th>
              ))}
              <Table.Th>{t('ai.supply.col.deficit')}</Table.Th>
              <Table.Th>{t('ai.supply.col.trips')}</Table.Th>
              <Table.Th>{t('ai.supply.col.priority')}</Table.Th>
            </tr>
          </Table.Head>
          <tbody>
            {rows.map((r) => {
              const on = picked.includes(r.shelterId)
              return (
                <Table.Row key={r.shelterId} className={clsx(r.critical && 'bg-critical-soft/40')}>
                  <Table.Td>
                    {r.deficitKg > 0 && (
                      <button
                        type="button"
                        role="checkbox"
                        aria-checked={on}
                        aria-label={r.name}
                        onClick={() => toggle(r.shelterId)}
                        className={clsx('flex h-5 w-5 items-center justify-center rounded-md border cursor-pointer', on ? 'border-info bg-info text-white' : 'border-border-strong')}
                      >
                        {on && <Check className="h-3.5 w-3.5" />}
                      </button>
                    )}
                  </Table.Td>
                  <Table.Td className="font-medium">
                    {r.name}
                    {r.critical && <Badge size="sm" variant="critical" className="ml-2">{t('ai.supply.criticalBadge')}</Badge>}
                  </Table.Td>
                  <Table.Td className="tabular-nums text-xs">
                    {r.people} → {r.forecastPeople}
                  </Table.Td>
                  <Table.Td className={clsx('tabular-nums', r.critical ? 'font-bold text-critical' : 'text-muted')}>
                    {r.coverageHours == null ? '∞' : `${r.coverageHours} ${t('ai.hours')}`}
                  </Table.Td>
                  {KINDS.map((k) => (
                    <Table.Td key={k} className={clsx('tabular-nums text-xs', r.deficit[k] ? 'text-text' : 'text-subtle')}>
                      {r.deficit[k] || '—'}
                    </Table.Td>
                  ))}
                  <Table.Td className="tabular-nums font-semibold">{r.deficitKg} kg</Table.Td>
                  <Table.Td className="tabular-nums text-xs">
                    {r.tripCount ? `${r.tripCount} · ${r.firstEtaMin} ${t('ai.min')}` : '—'}
                  </Table.Td>
                  <Table.Td className="tabular-nums">{r.priority}</Table.Td>
                </Table.Row>
              )
            })}
          </tbody>
        </Table>
      </Card>

      {plan.schedule.length > 0 && (
        <Card>
          <Card.Header title={t('ai.supply.scheduleTitle')} subtitle={t('ai.supply.scheduleHint')} icon={<Icon3D name="stopwatch" size={26} />} />
          <ol className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
            {plan.schedule.slice(0, 24).map((trip, i) => (
              <li key={i} className="rounded-lg border border-border bg-panel-2 p-3 text-sm">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-semibold text-text">{trip.drone} → {trip.shelter}</span>
                  <span className="tabular-nums text-xs text-muted">{formatTime(trip.etaAt)}</span>
                </div>
                <p className="mt-1 text-xs text-muted">
                  {trip.items.map((it) => `${it.quantity} ${t(`drones.units.${it.kind}`)}`).join(', ')} · {trip.loadKg} kg · {trip.distanceKm} km
                </p>
              </li>
            ))}
          </ol>
        </Card>
      )}
    </div>
  )
}
