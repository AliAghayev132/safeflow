import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Check, X } from 'lucide-react'

import { Badge, Button, Card, Select, StatusBadge } from '@components'
import { useCan } from '@hooks'
import { useAction } from '@store/hooks'
import { formatAgo } from '@utils'
import {
  useGetSuggestionQuery,
  useApproveSupplyRequestMutation,
  useCancelSupplyRequestMutation,
  useConfirmDeliveryMutation,
} from './api'
import { SUPPLY_STATUS } from './constants'
import { ItemChips, WeightProgress, DeliveryLine, useDuration } from './components'

/** Suggested drone + one-click "Təsdiqlə" (or pick another eligible drone). */
const DispatchBox = ({ request }) => {
  const { t } = useTranslation()
  const run = useAction()
  const duration = useDuration()
  const { data, isFetching } = useGetSuggestionQuery(request.id)
  const [approve, { isLoading }] = useApproveSupplyRequestMutation()
  const [override, setOverride] = useState('')

  if (!data) return <p className="text-xs text-muted">{isFetching ? t('drones.loadingSuggestion') : ''}</p>
  const eligible = data.ranked.filter((r) => r.eligible)
  const chosen = override ? eligible.find((r) => r.drone.id === override) : data.best

  if (!chosen) {
    return (
      <p className="text-xs text-warning">
        {t('drones.noDrone')}{' '}
        {data.ranked[0] && `(${t(`drones.reason.${data.ranked[0].reason}`)})`}
      </p>
    )
  }

  return (
    <div className="rounded-lg border border-info/40 bg-info-soft/30 p-3 space-y-2">
      <p className="text-xs font-semibold text-info">{t('drones.suggested')}</p>
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="font-semibold">{chosen.drone.name}</span>
        <Badge size="sm">{t('drones.loadOf', { load: chosen.loadKg, capacity: chosen.drone.payloadKg })}</Badge>
        <Badge size="sm">{chosen.distanceKm} km</Badge>
        <Badge size="sm" variant="warning">⏱ {duration(chosen.etaSec)}</Badge>
        <Badge size="sm" variant="success">🔋 {Math.round(chosen.drone.batteryPct)}% → −{Math.round(chosen.batteryNeededPct)}%</Badge>
        {!chosen.fullLoad && <Badge size="sm" variant="warning">{t('drones.partialLoad')}</Badge>}
      </div>
      <div className="flex flex-wrap items-end gap-2">
        {eligible.length > 1 && (
          <Select
            id={`override-${request.id}`}
            className="min-w-48"
            value={override}
            onChange={(e) => setOverride(e.target.value)}
            options={[
              { value: '', label: t('drones.useSuggested') },
              ...eligible.map((r) => ({ value: r.drone.id, label: `${r.drone.name} · ${duration(r.etaSec)}` })),
            ]}
          />
        )}
        <Button
          variant="success"
          size="sm"
          loading={isLoading}
          leftIcon={<Check className="w-4 h-4" />}
          onClick={() => run(approve({ id: request.id, droneId: override || undefined }), 'drones.toast.dispatched', { drone: chosen.drone.name })}
        >
          {t('drones.approve')}
        </Button>
      </div>
    </div>
  )
}

/**
 * One supply request: items, weight progress, deliveries with live ETA,
 * dispatch box (dispatcher) and receipt confirmation (shelter side).
 */
export const RequestCard = ({ request, shelterName, deliveries = [], droneNames = {}, now }) => {
  const { t } = useTranslation()
  const can = useCan()
  const run = useAction()
  const [cancel, { isLoading: cancelling }] = useCancelSupplyRequestMutation()
  const [confirm, { isLoading: confirming, originalArgs }] = useConfirmDeliveryMutation()
  const open = ['pending', 'in_progress'].includes(request.status)

  return (
    <Card className={request.priority === 'urgent' && open ? 'border-critical/60' : undefined}>
      <div className="flex flex-wrap items-start gap-3">
        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-semibold">{shelterName}</p>
            <StatusBadge meta={SUPPLY_STATUS[request.status]} label={t(`drones.supplyStatus.${request.status}`)} />
            <Badge variant={request.priority === 'urgent' ? 'solidCritical' : 'neutral'} size="sm">
              {t(`drones.priority.${request.priority}`)}
            </Badge>
            {request.source === 'auto' && <Badge variant="info" size="sm">{t('drones.autoProposed')}</Badge>}
            <span className="text-[11px] text-subtle">
              {request.createdBy} · {formatAgo(request.createdAt, now)}
            </span>
          </div>
          <ItemChips items={request.items} />
          {request.note && <p className="text-xs text-muted">{request.note}</p>}
        </div>
        <WeightProgress request={request} />
      </div>

      {deliveries.length > 0 && (
        <div className="mt-3 space-y-1.5">
          {deliveries.map((d) => (
            <DeliveryLine
              key={d.id}
              delivery={d}
              droneName={droneNames[d.drone]}
              action={
                d.status === 'arrived' && (can('supplies:confirm') || can('supplies:manage')) ? (
                  <Button
                    size="sm"
                    variant="success"
                    loading={confirming && originalArgs === d.id}
                    onClick={() => run(confirm(d.id), 'drones.toast.confirmed')}
                  >
                    {t('drones.confirmReceipt')}
                  </Button>
                ) : null
              }
            />
          ))}
        </div>
      )}

      {open && request.remainingKg > 0 && can('drones:dispatch') && (
        <div className="mt-3">
          <DispatchBox request={request} />
        </div>
      )}

      {open && can('supplies:manage') && request.dispatchedKg <= request.deliveredKg && (
        <div className="mt-3 flex justify-end">
          <Button
            size="sm"
            variant="ghost"
            loading={cancelling}
            leftIcon={<X className="w-4 h-4" />}
            onClick={() => run(cancel(request.id), 'drones.toast.cancelled')}
          >
            {t('drones.cancel')}
          </Button>
        </div>
      )}
    </Card>
  )
}
