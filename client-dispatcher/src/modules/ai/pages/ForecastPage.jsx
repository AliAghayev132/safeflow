import { useTranslation } from 'react-i18next'
import { clsx } from 'clsx'
import { RefreshCw, ArrowRight, TrendingUp, TrendingDown, Minus } from 'lucide-react'

import { Card, StatCard, StatusBadge, Button, Icon3D, PageLoader, EmptyState, Badge, Table } from '@components'
import { useAction } from '@store/hooks'
import { formatAgo } from '@utils'
import { useNow } from '@hooks'
import { useGetForecastQuery, useRefreshForecastMutation } from '../api'
import { useAiLive, AI_POLL_MS, RISK_META, pct } from '../shared'

const Bar = ({ now, later, capacity }) => {
  const a = Math.min(100, (now / Math.max(1, capacity)) * 100)
  const b = Math.min(100, (later / Math.max(1, capacity)) * 100)
  const color = b >= 90 ? 'bg-critical' : b >= 75 ? 'bg-warning' : 'bg-success'
  return (
    <div className="relative h-2.5 w-full overflow-hidden rounded-full bg-panel-3" aria-hidden>
      <div className={clsx('absolute inset-y-0 left-0 opacity-40', color)} style={{ width: `${b}%` }} />
      <div className={clsx('absolute inset-y-0 left-0', color)} style={{ width: `${a}%` }} />
      <span className="absolute inset-y-0 w-0.5 bg-text/60" style={{ left: '90%' }} />
    </div>
  )
}

const Trend = ({ v }) => {
  const Icon = v > 0.5 ? TrendingUp : v < -0.5 ? TrendingDown : Minus
  return (
    <span className={clsx('inline-flex items-center gap-1 tabular-nums', v > 0.5 ? 'text-warning' : 'text-muted')}>
      <Icon className="h-3.5 w-3.5" aria-hidden /> {v > 0 ? '+' : ''}
      {v}/dəq
    </span>
  )
}

/**
 * Predictive crowd analytics: occupancy 15 / 30 min ahead per assembly
 * point, road bottlenecks, SOS surges, proactive warnings and routing
 * recommendations (Holt time-series model, recomputed every sample).
 */
export const ForecastPage = () => {
  const { t } = useTranslation()
  useAiLive()
  const now = useNow(15000)
  const run = useAction()
  const { data: f, isLoading } = useGetForecastQuery(undefined, { pollingInterval: AI_POLL_MS })
  const [refresh, { isLoading: refreshing }] = useRefreshForecastMutation()

  if (isLoading) return <PageLoader />
  if (!f) return <EmptyState icon="chart" title={t('app.loadFailed')} />
  const [h1, h2] = f.horizons

  return (
    <div className="space-y-4 p-4">
      <Card className="flex flex-wrap items-center gap-3">
        <Icon3D name="chart" size={38} />
        <div className="min-w-60 flex-1">
          <h2 className="font-semibold">{t('ai.forecast.title')}</h2>
          <p className="text-xs text-muted">
            {t('ai.forecast.subtitle', { samples: f.model.samples, at: formatAgo(f.generatedAt, now) })}
          </p>
        </div>
        <Badge variant="neutral">Holt α={f.model.alpha} β={f.model.beta}</Badge>
        <Button size="sm" variant="secondary" loading={refreshing} onClick={() => run(refresh())} leftIcon={<RefreshCw className="h-4 w-4" />}>
          {t('ai.refresh')}
        </Button>
      </Card>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard icon="people" title={t('ai.forecast.evacuating')} value={`${f.evacuating.now} → ${f.evacuating.predicted}`} hint={t('ai.forecast.inMin', { min: h2 })} />
        <StatCard icon="siren" tone={f.warnings.length ? 'critical' : 'neutral'} title={t('ai.forecast.warnings')} value={f.warnings.length} />
        <StatCard icon="stadium" tone={f.shelters.some((s) => s.predictions[h2].risk !== 'normal') ? 'warning' : 'neutral'} title={t('ai.forecast.atRisk')} value={f.shelters.filter((s) => ['critical', 'overflow'].includes(s.predictions[h2].risk)).length} />
        <StatCard icon="motorway" title={t('ai.forecast.bottlenecks')} value={f.bottlenecks.filter((b) => b.congested).length} />
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <Card.Header title={t('ai.forecast.warningsTitle')} icon={<Icon3D name="warning" size={26} />} />
          {f.warnings.length === 0 ? (
            <p className="text-sm text-muted">{t('ai.forecast.noWarnings', { min: h2 })}</p>
          ) : (
            <ul className="space-y-2">
              {f.warnings.map((w, i) => (
                <li key={i} className={clsx('rounded-lg border p-3 text-sm', w.severity === 'critical' ? 'border-critical bg-critical-soft' : 'border-warning/50 bg-warning-soft')}>
                  <p className="font-semibold text-text">{t(`ai.forecast.warning.${w.kind}`, { ...w, rate: pct(w.predictedRate) })}</p>
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card>
          <Card.Header title={t('ai.forecast.recommendationsTitle')} icon={<Icon3D name="compass" size={26} />} />
          {f.recommendations.length === 0 ? (
            <p className="text-sm text-muted">{t('ai.forecast.noRecommendations')}</p>
          ) : (
            <ul className="space-y-2">
              {f.recommendations.map((r, i) => (
                <li key={i} className="flex items-start gap-2 rounded-lg border border-border bg-panel-2 p-3 text-sm text-text">
                  <ArrowRight className="mt-0.5 h-4 w-4 shrink-0 text-info" aria-hidden />
                  <span>
                    {t(`ai.forecast.rec.${r.kind}`, {
                      from: r.from?.name,
                      to: r.to?.name,
                      km: ((r.distanceMeters ?? 0) / 1000).toFixed(1),
                      left: r.capacityLeft,
                      near: r.near?.name,
                      shelter: r.shelter?.name,
                      name: r.name,
                      people: r.people,
                      zone: r.zone?.name,
                      sos: r.expectedSos,
                    })}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <Card padding="none">
        <div className="p-4 pb-2">
          <Card.Header title={t('ai.forecast.sheltersTitle')} subtitle={t('ai.forecast.sheltersHint')} icon={<Icon3D name="stadium" size={26} />} className="mb-0" />
        </div>
        <Table className="rounded-none border-0">
          <Table.Head>
            <tr>
              <Table.Th>{t('ai.forecast.col.shelter')}</Table.Th>
              <Table.Th>{t('ai.forecast.col.now')}</Table.Th>
              <Table.Th>{t('ai.forecast.col.trend')}</Table.Th>
              <Table.Th>+{h1} {t('ai.min')}</Table.Th>
              <Table.Th className="w-56">+{h2} {t('ai.min')}</Table.Th>
              <Table.Th>{t('ai.forecast.col.risk')}</Table.Th>
            </tr>
          </Table.Head>
          <tbody>
            {[...f.shelters]
              .sort((a, b) => b.predictions[h2].rate - a.predictions[h2].rate)
              .map((s) => {
                const p1 = s.predictions[h1]
                const p2 = s.predictions[h2]
                return (
                  <Table.Row key={s.id}>
                    <Table.Td className="font-medium">{s.name}</Table.Td>
                    <Table.Td className="tabular-nums">{pct(s.rate)}</Table.Td>
                    <Table.Td className="text-xs"><Trend v={s.trendPerMin} /></Table.Td>
                    <Table.Td className="tabular-nums">{pct(p1.rate)}</Table.Td>
                    <Table.Td>
                      <div className="mb-1 flex justify-between text-xs tabular-nums">
                        <span>{pct(p2.rate)}</span>
                        {s.samples >= 3 && <span className="text-subtle">±{p2.band}</span>}
                      </div>
                      <Bar now={s.occupancy} later={p2.occupancy} capacity={s.capacity} />
                    </Table.Td>
                    <Table.Td>
                      <StatusBadge size="sm" meta={RISK_META[p2.risk]} label={t(`ai.risk.${p2.risk}`)} />
                    </Table.Td>
                  </Table.Row>
                )
              })}
          </tbody>
        </Table>
      </Card>

      {f.bottlenecks.length > 0 && (
        <Card>
          <Card.Header title={t('ai.forecast.bottlenecksTitle')} icon={<Icon3D name="motorway" size={26} />} />
          <ul className="grid gap-2 md:grid-cols-2">
            {f.bottlenecks.slice(0, 10).map((b) => (
              <li key={b.edgeId} className="flex items-center gap-3 rounded-lg border border-border bg-panel-2 px-3 py-2 text-sm">
                <span className="min-w-0 flex-1 truncate">{b.name}</span>
                <span className="tabular-nums text-muted">{b.now} → <strong className={b.congested ? 'text-critical' : 'text-text'}>{b.predicted}</strong></span>
                {b.congested && <Badge size="sm" variant="critical">{t('ai.forecast.congested')}</Badge>}
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  )
}
