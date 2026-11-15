import { useEffect, useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { useTranslation } from 'react-i18next'
import { clsx } from 'clsx'
import { Check, X, MapPin, CircleSlash, Lock } from 'lucide-react'
import {
  useApproveAlertMutation,
  useRejectAlertMutation,
  useResolveAlertMutation,
} from '@store/api'
import { useAction } from '@store/hooks'
import {
  selectZoneById,
  selectBrigadeEntities,
  selectShelterEntities,
} from '@store/slices/liveSlice'
import { alertAcknowledged, alertFreshCleared } from '@store/slices/uiSlice'
import { ALERT_TYPES, ALERT_STATUS, ALERT_ACTIONS } from '@constants'
import { formatAgo, formatTime, alertText } from '@utils'
import { useNow, useCan } from '@hooks'
import { Icon3D } from '../ui/Icon3D'
import { Badge } from '../ui/Badge'
import { StatusBadge } from '../ui/StatusBadge'
import { Button } from '../ui/Button'

const etaMin = (sec) => Math.max(1, Math.round((Number(sec) || 0) / 60))

/**
 * Brigade auto-suggestion on an active alert: recommended brigade + ETA,
 * pick an alternative with one click, or — when none is free — the brigade
 * that frees up soonest.
 */
const BrigadeSuggestion = ({ suggestion, chosen, onChoose }) => {
  const { t } = useTranslation()
  if (!suggestion) return null
  const options = [suggestion.suggestion, ...(suggestion.alternatives ?? [])].filter(Boolean)

  if (!options.length) {
    const soon = suggestion.soonestFree
    return (
      <p className="mt-1 text-xs font-medium text-warning flex items-start gap-1" role="status">
        <CircleSlash className="w-3.5 h-3.5 mt-0.5 shrink-0" />
        {soon
          ? t('suggest.noneFree', { name: soon.name, free: etaMin(soon.freeInSec), eta: etaMin(soon.etaSec) })
          : t('suggest.noneAtAll')}
      </p>
    )
  }

  return (
    <div className="mt-1.5 flex flex-wrap gap-1.5" role="radiogroup" aria-label={t('suggest.choose')}>
      {options.map((o, i) => {
        const selected = (chosen ?? options[0].brigadeId) === o.brigadeId
        return (
          <button
            key={o.brigadeId}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChoose(i === 0 ? null : o.brigadeId)}
            className={clsx(
              'h-8 px-2.5 rounded-lg border text-xs font-semibold cursor-pointer inline-flex items-center gap-1.5',
              selected ? 'bg-critical text-white border-critical' : 'bg-panel border-border text-muted hover:text-text'
            )}
          >
            {selected && <Check className="w-3.5 h-3.5" />}
            {o.name} · {t('suggest.eta', { minutes: etaMin(o.etaSec) })}
            {!o.typeMatch && <span className="opacity-75">· {t('suggest.otherType')}</span>}
          </button>
        )
      })}
    </div>
  )
}

const ActionRow = ({ action, decided, chosen, onChoose }) => {
  const { t } = useTranslation()
  const brigades = useSelector(selectBrigadeEntities)
  const shelters = useSelector(selectShelterEntities)

  let label
  if (action.type === 'dispatch_brigade') {
    const name = brigades[action.brigade]?.name
    label = name ? t('alert.action.dispatch_brigade', { name }) : t('alert.action.dispatch_brigade_none')
  } else {
    label = t('alert.action.open_shelter', { name: shelters[action.shelter]?.name ?? t('app.none') })
  }

  return (
    <li className="flex items-start gap-2.5 py-1.5">
      <Icon3D name={ALERT_ACTIONS[action.type]?.icon ?? 'gear'} size={22} />
      <div className="flex-1 min-w-0">
        <p className="text-sm text-text leading-snug">{label}</p>
        {!decided && action.type === 'dispatch_brigade' && (
          <BrigadeSuggestion suggestion={action.suggestion} chosen={chosen} onChoose={onChoose} />
        )}
        {decided && (
          <p
            className={clsx(
              'text-xs mt-0.5 flex items-center gap-1',
              action.executed ? 'text-success' : 'text-warning'
            )}
            title={action.result || undefined}
          >
            {action.executed ? <Check className="w-3.5 h-3.5" /> : <CircleSlash className="w-3.5 h-3.5" />}
            {action.executed ? t('alert.result.done') : t('alert.result.failed')}
          </p>
        )}
      </div>
    </li>
  )
}

/**
 * Crisis alert card. Active alerts are a prominent red card with the
 * one-click "approve & execute" decision (permission: alert:decide).
 */
export const AlertCard = ({ alert, onFocus, fresh = false }) => {
  const dispatch = useDispatch()
  const { t } = useTranslation()
  const now = useNow(15000)
  const zones = useSelector(selectZoneById)
  const canDecide = useCan('alert:decide')
  const run = useAction()
  const [approve, { isLoading: approving }] = useApproveAlertMutation()
  const [reject, { isLoading: rejecting }] = useRejectAlertMutation()
  const [resolve, { isLoading: resolving }] = useResolveAlertMutation()
  // Dispatcher may pick an alternative brigade before approving (null = suggested one)
  const [chosenBrigade, setChosenBrigade] = useState(null)

  const isActive = alert.status === 'active'
  const type = ALERT_TYPES[alert.type] ?? ALERT_TYPES.sos_cluster
  const zone = zones[alert.zone]
  const { title, message } = alertText(alert, zones)

  useEffect(() => {
    if (!fresh) return
    const id = setTimeout(() => dispatch(alertFreshCleared(alert.id)), 3000)
    return () => clearTimeout(id)
  }, [fresh, alert.id, dispatch])

  const onApprove = async () => {
    const result = await run(
      approve(chosenBrigade ? { id: alert.id, brigadeId: chosenBrigade } : alert.id),
      'toast.alertApproved'
    )
    if (result) dispatch(alertAcknowledged(alert.id))
  }
  const onReject = async () => {
    const result = await run(reject(alert.id), 'toast.alertRejected')
    if (result) dispatch(alertAcknowledged(alert.id))
  }
  const onResolve = () => run(resolve(alert.id), 'toast.alertResolved')

  return (
    <article
      className={clsx(
        'rounded-xl border p-4',
        isActive ? 'bg-critical-soft border-critical border-l-4' : 'bg-panel border-border',
        fresh && isActive && 'alert-flash'
      )}
    >
      <header className="flex items-start gap-3">
        <Icon3D name={type.icon} size={isActive ? 40 : 30} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            {isActive ? (
              <Badge variant="solidCritical" size="sm">
                <span className="w-1.5 h-1.5 rounded-full bg-white blink" />
                {t('alert.critical')}
              </Badge>
            ) : (
              <StatusBadge size="sm" meta={ALERT_STATUS[alert.status]} label={t(`alertStatus.${alert.status}`)} />
            )}
            <span className="text-[11px] text-muted">{t(`alertType.${alert.type}`)}</span>
            <span className="text-[11px] text-subtle ml-auto" title={formatTime(alert.createdAt)}>
              {formatAgo(alert.createdAt, now)}
            </span>
          </div>
          <h4 className={clsx('mt-1.5 font-semibold leading-snug text-text', isActive ? 'text-[15px]' : 'text-sm')}>
            {title}
          </h4>
        </div>
      </header>

      <p className="text-sm text-muted mt-2 leading-relaxed">{message}</p>

      <div className="flex items-center gap-4 mt-2 text-xs text-muted">
        {zone && (
          <span>
            {t('alert.zone')}: <strong className="text-text">{zone.name}</strong>
          </span>
        )}
        {alert.type === 'sos_cluster' && (
          <span>
            {t('alert.signals')}: <strong className="text-text tabular-nums">{alert.signalCount}</strong>
          </span>
        )}
        {onFocus && (
          <button
            onClick={() => onFocus(alert)}
            className="ml-auto inline-flex items-center gap-1 text-info hover:underline cursor-pointer"
          >
            <MapPin className="w-3.5 h-3.5" /> {t('app.onMap')}
          </button>
        )}
      </div>

      {alert.actions.length > 0 && (
        <div className="mt-3">
          <p className="text-[11px] uppercase tracking-wide text-muted font-semibold">
            {isActive ? t('alert.recommended') : t('alert.executed')}
          </p>
          <ul className="mt-1 divide-y divide-border/60">
            {alert.actions.map((action) => (
              <ActionRow
                key={action.id}
                action={action}
                decided={!isActive}
                chosen={chosenBrigade}
                onChoose={setChosenBrigade}
              />
            ))}
          </ul>
        </div>
      )}

      {isActive &&
        (canDecide ? (
          <div className="flex gap-2 mt-3">
            <Button
              variant="critical"
              size="lg"
              className="flex-1"
              loading={approving}
              disabled={rejecting}
              onClick={onApprove}
              leftIcon={<Check className="w-5 h-5" />}
            >
              {t('alert.approve')}
            </Button>
            <Button
              variant="outline"
              size="lg"
              loading={rejecting}
              disabled={approving}
              onClick={onReject}
              leftIcon={<X className="w-4 h-4" />}
            >
              {t('alert.reject')}
            </Button>
          </div>
        ) : (
          <p className="mt-3 text-xs text-muted flex items-center gap-1.5">
            <Lock className="w-3.5 h-3.5" /> {t('alert.readOnly')}
          </p>
        ))}

      {alert.status === 'approved' && (
        <div className="flex items-center justify-between mt-3 pt-3 border-t border-border">
          <span className="text-xs text-muted">{t('alert.decidedAt', { time: formatTime(alert.decidedAt) })}</span>
          {canDecide && (
            <Button variant="secondary" size="sm" loading={resolving} onClick={onResolve}>
              {t('alert.resolve')}
            </Button>
          )}
        </div>
      )}
    </article>
  )
}
