import { useMemo, useState } from 'react'
import { useSelector } from 'react-redux'
import { useTranslation } from 'react-i18next'

import { Card, EmptyState, PageLoader, StatCard } from '@components'
import { selectShelters } from '@store/slices/liveSlice'
import { useNow } from '@hooks'

import { useGetSupplyRequestsQuery, useGetDeliveriesQuery, useGetFleetQuery } from '../../api'
import { useDroneLive, DRONE_POLL_MS } from '../../useDroneLive'
import { RequestForm } from '../../RequestForm'
import { RequestCard } from '../../RequestCard'

const FILTERS = ['open', 'delivered', 'all']

/**
 * Supply requests (dispatcher): create (with occupancy-based estimate),
 * suggested drone + one-click approve, live delivery ETA.
 */
export const SuppliesPage = () => {
  const { t } = useTranslation()
  useDroneLive()
  const now = useNow(15000)
  const shelters = useSelector(selectShelters)
  const [filter, setFilter] = useState('open')
  const status = filter === 'open' ? 'pending,in_progress' : filter === 'delivered' ? 'delivered' : undefined

  const { data: requests = [], isLoading } = useGetSupplyRequestsQuery(status ? { status } : {}, { pollingInterval: DRONE_POLL_MS })
  const { data: deliveries = [] } = useGetDeliveriesQuery({}, { pollingInterval: DRONE_POLL_MS })
  const { data: fleet } = useGetFleetQuery()

  const shelterName = useMemo(() => Object.fromEntries(shelters.map((s) => [s.id, s.name])), [shelters])
  const droneNames = useMemo(() => Object.fromEntries((fleet?.drones ?? []).map((d) => [d.id, d.name])), [fleet])
  const byRequest = useMemo(() => {
    const m = {}
    for (const d of deliveries) (m[d.request] ??= []).push(d)
    return m
  }, [deliveries])
  const active = shelters.filter((s) => s.isActive)
  const urgent = requests.filter((r) => r.priority === 'urgent' && r.status === 'pending').length
  const inFlight = deliveries.filter((d) => ['loading', 'en_route'].includes(d.status)).length
  const awaiting = deliveries.filter((d) => d.status === 'arrived').length

  return (
    <div className="p-5 space-y-4">
      <div className="grid gap-3 grid-cols-[repeat(auto-fit,minmax(180px,1fr))]">
        <StatCard icon="tent" title={t('drones.stats.open')} value={requests.filter((r) => r.status !== 'delivered' && r.status !== 'cancelled').length} />
        <StatCard icon="siren" title={t('drones.stats.urgent')} value={urgent} tone={urgent ? 'critical' : 'neutral'} />
        <StatCard icon="helicopter" title={t('drones.stats.inFlight')} value={inFlight} />
        <StatCard icon="safe" title={t('drones.stats.awaiting')} value={awaiting} tone={awaiting ? 'warning' : 'neutral'} />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_400px] gap-4 items-start">
        <div className="space-y-3 min-w-0">
          <div className="flex gap-2">
            {FILTERS.map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                aria-pressed={filter === f}
                className={`h-9 px-3 rounded-lg text-sm font-medium border cursor-pointer ${
                  filter === f ? 'bg-panel-3 border-border-strong text-text' : 'bg-panel border-border text-muted hover:text-text'
                }`}
              >
                {t(`drones.filter.${f}`)}
              </button>
            ))}
          </div>
          {isLoading ? (
            <PageLoader />
          ) : requests.length === 0 ? (
            <Card>
              <EmptyState icon="tent" title={t('drones.emptyRequests')} />
            </Card>
          ) : (
            requests.map((r) => (
              <RequestCard
                key={r.id}
                request={r}
                shelterName={shelterName[r.shelter] ?? r.shelter}
                deliveries={byRequest[r.id]}
                droneNames={droneNames}
                now={now}
              />
            ))
          )}
        </div>
        <div className="xl:sticky xl:top-4">
          <RequestForm shelters={active} />
        </div>
      </div>
    </div>
  )
}
