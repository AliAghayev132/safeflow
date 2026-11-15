/* Shared building blocks of the drones module pages. */
/* eslint-disable react-refresh/only-export-components */
import { useTranslation } from 'react-i18next'
import { Icon3D, StatusBadge, Badge, ProgressBar } from '@components'
import { COLORS } from '@constants'
import { useNow } from '@hooks'
import { DELIVERY_STATUS, SUPPLY_ICONS, remainingSec, batteryVariant } from './constants'

/** "4 dəq 05 san" */
export const useDuration = () => {
  const { t } = useTranslation()
  return (sec) => {
    const s = Math.max(0, Math.round(sec ?? 0))
    const m = Math.floor(s / 60)
    return m ? t('drones.duration.min', { m, s: String(s % 60).padStart(2, '0') }) : t('drones.duration.sec', { s })
  }
}

/** Items as icon + quantity + unit chips. */
export const ItemChips = ({ items }) => {
  const { t } = useTranslation()
  return (
    <div className="flex flex-wrap gap-1.5">
      {items.map((i) => (
        <span
          key={i.kind}
          className="inline-flex items-center gap-1.5 rounded-md border border-border bg-panel-2 px-2 py-1 text-xs"
        >
          <Icon3D name={SUPPLY_ICONS[i.kind]} size={16} />
          <span className="font-semibold tabular-nums">{i.quantity}</span>
          <span className="text-muted">{t(`drones.units.${i.kind}`)}</span>
        </span>
      ))}
    </div>
  )
}

/** Battery as a solid bar + % with a semantic colour. */
export const Battery = ({ pct }) => {
  const variant = batteryVariant(pct)
  const color = variant === 'success' ? COLORS.success : variant === 'warning' ? COLORS.warning : COLORS.critical
  return (
    <div className="flex items-center gap-2 min-w-28">
      <ProgressBar value={pct / 100} color={color} className="flex-1" />
      <span className="text-xs tabular-nums font-semibold" style={{ color }}>
        {Math.round(pct)}%
      </span>
    </div>
  )
}

/** Delivery status + live ETA countdown (ticks every second). */
export const DeliveryLine = ({ delivery, droneName, action }) => {
  const { t } = useTranslation()
  const now = useNow(1000)
  const duration = useDuration()
  const live = ['loading', 'en_route'].includes(delivery.status)
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-panel-2 px-3 py-2 text-xs">
      <Icon3D name="helicopter" size={20} />
      <span className="font-medium">{droneName ?? t('drones.drone')}</span>
      <StatusBadge size="sm" meta={DELIVERY_STATUS[delivery.status]} label={t(`drones.deliveryStatus.${delivery.status}`)} />
      <span className="text-muted tabular-nums">{delivery.loadKg} kg</span>
      {live && delivery.etaAt && (
        <Badge variant="warning" size="sm">
          ⏱ {t('drones.eta', { time: duration(remainingSec(delivery.etaAt, now)) })}
        </Badge>
      )}
      {action && <span className="ml-auto">{action}</span>}
    </div>
  )
}

/** Delivered / dispatched / total weight. */
export const WeightProgress = ({ request }) => {
  const { t } = useTranslation()
  const total = request.totalKg || 1
  return (
    <div className="min-w-40">
      <ProgressBar value={request.deliveredKg / total} color={COLORS.success} />
      <p className="mt-1 text-[11px] text-muted tabular-nums">
        {t('drones.weightProgress', {
          delivered: request.deliveredKg,
          dispatched: request.dispatchedKg,
          total: request.totalKg,
        })}
      </p>
    </div>
  )
}
