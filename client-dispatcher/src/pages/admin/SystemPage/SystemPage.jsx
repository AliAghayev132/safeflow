// Redux
import { useSelector } from 'react-redux'
import { useGetSystemQuery } from '@store/api'

// i18n
import { useTranslation } from 'react-i18next'

// Icons
import { ChevronRight, CircleCheck, Ban } from 'lucide-react'

// Components
import { Card, Icon3D, PageLoader, EmptyState, StatusBadge, StatCard } from '@components'

// Constants
import { BREAKER_STATE, CONNECTION_MODES } from '@constants'

const PROVIDER_ICONS = { external: 'antenna', graph: 'motorway', straight: 'compass' }

/**
 * Routing fallback chain (external API → simulated graph → straight line)
 * with the external circuit-breaker state, realtime log position and socket
 * connections. Polled every 5 s.
 */
export const SystemPage = () => {
  const { t } = useTranslation()
  const { data, isLoading, isError } = useGetSystemQuery(undefined, { pollingInterval: 5000 })
  const connection = useSelector((state) => state.ui.connection)
  const cursor = useSelector((state) => state.ui.realtime)

  if (isLoading) return <PageLoader />
  if (isError || !data) return <EmptyState icon="antenna" title={t('app.loadFailed')} />

  const { routing, realtime } = data
  const breaker = routing.external.breaker
  const uptimeH = Math.floor(data.uptimeSec / 3600)
  const uptimeM = Math.floor((data.uptimeSec % 3600) / 60)

  const providerStatus = (name) => {
    if (name === 'external') {
      if (!routing.external.configured) {
        return <StatusBadge meta={{ variant: 'neutral', Icon: Ban }} label={t('system.notConfigured')} />
      }
      return (
        <div className="space-y-1">
          <StatusBadge meta={{ variant: 'success', Icon: CircleCheck }} label={t('system.configured')} />
          <div className="flex items-center gap-1.5 text-xs text-muted">
            {t('system.breaker')}:
            <StatusBadge size="sm" meta={BREAKER_STATE[breaker.state]} label={t(`system.breakerState.${breaker.state}`)} />
          </div>
          <p className="text-[11px] text-subtle">{t('system.failures', { count: breaker.failures })}</p>
        </div>
      )
    }
    if (name === 'graph') {
      return (
        <div className="space-y-1">
          <StatusBadge
            meta={routing.graph.nodes ? { variant: 'success', Icon: CircleCheck } : { variant: 'critical', Icon: Ban }}
            label={routing.graph.nodes ? t('system.configured') : t('system.notConfigured')}
          />
          <p className="text-[11px] text-subtle">
            {t('system.graph', { nodes: routing.graph.nodes, edges: routing.graph.edges })}
          </p>
        </div>
      )
    }
    return <StatusBadge meta={{ variant: 'success', Icon: CircleCheck }} label={t('system.configured')} />
  }

  return (
    <div className="p-5 space-y-4">
      <Card>
        <Card.Header
          title={t('system.routing')}
          subtitle={t('system.routingHint')}
          icon={<Icon3D name="motorway" size={30} />}
        />
        <ol className="flex flex-col lg:flex-row lg:items-stretch gap-3">
          {routing.providers.map((name, i) => (
            <li key={name} className="flex items-center gap-3 flex-1">
              <div className="flex-1 bg-panel-2 border border-border rounded-lg p-3 h-full">
                <div className="flex items-center gap-2 mb-2">
                  <span className="w-6 h-6 rounded-md bg-panel-3 text-xs font-bold flex items-center justify-center">
                    {i + 1}
                  </span>
                  <Icon3D name={PROVIDER_ICONS[name] ?? 'gear'} size={24} />
                  <p className="font-semibold text-sm">{t(`system.provider.${name}`, { defaultValue: name })}</p>
                </div>
                {providerStatus(name)}
              </div>
              {i < routing.providers.length - 1 && <ChevronRight className="w-5 h-5 text-subtle shrink-0 max-lg:hidden" />}
            </li>
          ))}
        </ol>
      </Card>

      <Card>
        <Card.Header title={t('system.realtime')} icon={<Icon3D name="antenna" size={30} />} />
        <div className="grid gap-3 grid-cols-[repeat(auto-fit,minmax(180px,1fr))]">
          <StatCard title={t('system.epoch')} value={<span className="font-mono text-lg">{realtime.epoch}</span>} />
          <StatCard title={t('system.lastSeq')} value={realtime.lastSeq} />
          <StatCard title={t('system.clientSeq')} value={cursor.seq} />
          <StatCard title={t('system.connections')} value={realtime.connections} />
          <div className="bg-panel border border-border rounded-xl px-4 py-3">
            <p className="text-[11px] font-medium uppercase tracking-wide text-muted">{t('system.mode')}</p>
            <div className="mt-1.5">
              <StatusBadge meta={CONNECTION_MODES[connection]} label={t(`connection.${connection}`)} />
            </div>
          </div>
        </div>
      </Card>

      <Card>
        <Card.Header title={t('system.server')} icon={<Icon3D name="gear" size={30} />} />
        <div className="grid gap-3 grid-cols-[repeat(auto-fit,minmax(180px,1fr))]">
          <StatCard icon="stopwatch" title={t('system.uptime')} value={t('system.uptimeValue', { h: uptimeH, m: uptimeM })} />
          <StatCard icon="chart" title={t('system.memory')} value={t('system.memoryValue', { value: data.memoryMb })} />
        </div>
      </Card>
    </div>
  )
}
