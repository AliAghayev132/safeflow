import { useMemo } from 'react'
import { useSelector } from 'react-redux'
import { useTranslation } from 'react-i18next'

import { Card, EmptyState, Icon3D, PageLoader, ProgressBar, StatCard } from '@components'
import { selectShelterEntities } from '@store/slices/liveSlice'
import { occupancyColor, formatNumber, formatPercent } from '@utils'
import { useNow } from '@hooks'

import { useGetSupplyRequestsQuery, useGetDeliveriesQuery, useGetFleetQuery, useGetEstimateQuery } from '../../api'
import { useDroneLive, DRONE_POLL_MS } from '../../useDroneLive'
import { RequestForm } from '../../RequestForm'
import { RequestCard } from '../../RequestCard'
import { ItemChips } from '../../components'

/**
 * Shelter manager view ("Məntəqəm"): own shelter, occupancy-based estimate,
 * own requests, live delivery ETA and receipt confirmation.
 */
export const MyShelterPage = () => {
  const { t } = useTranslation()
  useDroneLive()
  const now = useNow(15000)
  const operator = useSelector((state) => state.auth.operator)
  const shelters = useSelector(selectShelterEntities)
  const shelter = operator?.shelter ? shelters[operator.shelter] : null

  const { data: requests = [], isLoading } = useGetSupplyRequestsQuery({}, { pollingInterval: DRONE_POLL_MS })
  const { data: deliveries = [] } = useGetDeliveriesQuery({}, { pollingInterval: DRONE_POLL_MS })
  const { data: fleet } = useGetFleetQuery()
  const { data: estimate } = useGetEstimateQuery(undefined, { skip: !operator?.shelter })

  const droneNames = useMemo(() => Object.fromEntries((fleet?.drones ?? []).map((d) => [d.id, d.name])), [fleet])
  const byRequest = useMemo(() => {
    const m = {}
    for (const d of deliveries) (m[d.request] ??= []).push(d)
    return m
  }, [deliveries])

  if (!operator?.shelter) {
    return (
      <div className="p-5">
        <Card>
          <EmptyState icon="shelter" title={t('drones.noShelter')} />
        </Card>
      </div>
    )
  }

  const enRoute = deliveries.filter((d) => ['loading', 'en_route'].includes(d.status)).length
  const awaiting = deliveries.filter((d) => d.status === 'arrived').length

  return (
    <div className="p-5 space-y-4">
      {shelter && (
        <Card>
          <div className="flex flex-wrap items-center gap-4">
            <Icon3D name="shelter" size={44} />
            <div className="min-w-0 flex-1">
              <p className="text-lg font-semibold">{shelter.name}</p>
              <p className="text-xs text-muted">{shelter.address}</p>
            </div>
            <div className="min-w-60">
              <div className="flex justify-between text-xs mb-1">
                <span>
                  {formatNumber(shelter.occupancy)} / {formatNumber(shelter.capacity)}
                </span>
                <strong style={{ color: occupancyColor(shelter.occupancyRate) }}>{formatPercent(shelter.occupancyRate)}</strong>
              </div>
              <ProgressBar value={shelter.occupancyRate} color={occupancyColor(shelter.occupancyRate)} />
            </div>
          </div>
        </Card>
      )}

      <div className="grid gap-3 grid-cols-[repeat(auto-fit,minmax(180px,1fr))]">
        <StatCard icon="helicopter" title={t('drones.stats.inFlight')} value={enRoute} />
        <StatCard icon="safe" title={t('drones.stats.awaiting')} value={awaiting} tone={awaiting ? 'warning' : 'neutral'} />
        <StatCard icon="tent" title={t('drones.stats.open')} value={requests.filter((r) => ['pending', 'in_progress'].includes(r.status)).length} />
      </div>

      {estimate?.items?.length > 0 && (
        <Card>
          <Card.Header title={t('drones.estimateTitle')} subtitle={t('drones.estimateText', { people: estimate.people, kg: estimate.totalKg })} icon={<Icon3D name="chart" size={26} />} />
          <ItemChips items={estimate.items} />
        </Card>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_400px] gap-4 items-start">
        <div className="space-y-3 min-w-0">
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
                shelterName={shelter?.name ?? ''}
                deliveries={byRequest[r.id]}
                droneNames={droneNames}
                now={now}
              />
            ))
          )}
        </div>
        <div className="xl:sticky xl:top-4">
          <RequestForm fixedShelterName={shelter?.name} />
        </div>
      </div>
    </div>
  )
}
