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
import { BrigadePicker } from '../brigades/BrigadePicker'

const etaMin = (sec) => Math.max(1, Math.round((Number(sec) || 0) / 60))

/**
 * Brigade auto-suggestion on an active alert: recommended brigade + ETA and
 * alternatives as toggle chips — the dispatcher can send ONE or a whole team
 * (and add any other free brigade with the picker). When none is free, the
 * brigade that frees up soonest is shown.
 */
const BrigadeSuggestion = ({ suggestion, team, onTeam, target, brigadeType }) => {
  const { t } = useTranslation()
  const brigades = useSelector(selectBrigadeEntities)
  if (!suggestion) return null
  const options = [suggestion.suggestion, ...(suggestion.alternatives ?? [])].filter(Boolean)
  const selected = team ?? (options[0] ? [options[0].brigadeId] : [])
  const optionIds = new Set(options.map((o) => o.brigadeId))
  const extras = selected.filter((id) => !optionIds.has(id))

  const toggle = (id) => {
    const next = selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id]
    onTeam(next)
  }

  const picker = (
    <BrigadePicker
      target={target}
      preferredType={brigadeType}
      exclude={selected}
      label={t('brigadePicker.reinforce')}
      submitLabel={t('brigadePicker.addToTeam')}
      onSubmit={(ids) => {
        onTeam([...selected, ...ids])
        return true
      }}
    />
  )

  if (!options.length) {
    const soon = suggestion.soonestFree
    return (
      <div className="mt-1.5 space-y-1.5">
        <p className="text-xs font-medium text-warning flex items-start gap-1" role="status">
          <CircleSlash className="w-3.5 h-3.5 mt-0.5 shrink-0" />
          {soon
            ? t('suggest.noneFree', { name: soon.name, free: etaMin(soon.freeInSec), eta: etaMin(soon.etaSec) })
            : t('suggest.noneAtAll')}
        </p>
        {extras.length > 0 && <TeamChips ids={extras} brigades={brigades} onToggle={toggle} />}
      </div>
    )
  }

  return (
    <div className="mt-1.5 space-y-1.5">
      <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label={t('suggest.choose')}>
        {options.map((o) => {
          const on = selected.includes(o.brigadeId)
          return (
            <button
              key={o.brigadeId}
              type="button"
              role="checkbox"
              aria-checked={on}
              onClick={() => toggle(o.brigadeId)}
              className={clsx(
                'h-8 px-2.5 rounded-lg border text-xs font-semibold cursor-pointer inline-flex items-center gap-1.5 transition-colors',
                on ? 'bg-critical text-white border-critical' : 'bg-panel border-border text-muted hover:text-text'
              )}
            >
              {on && <Check className="w-3.5 h-3.5" />}
              {o.name} · {t('suggest.eta', { minutes: etaMin(o.etaSec) })}
              {!o.typeMatch && <span className="opacity-75">· {t('suggest.otherType')}</span>}
            </button>
          )
        })}
        <TeamChips ids={extras} brigades={brigades} onToggle={toggle} />
        {picker}
      </div>
      {selected.length > 1 && (
        <p className="text-xs font-semibold text-text">{t('brigadePicker.teamOf', { count: selected.length })}</p>
      )}
    </div>
  )
}

const TeamChips = ({ ids, brigades, onToggle }) =>
  ids.map((id) => (
    <button
      key={id}
      type="button"
      role="checkbox"
      aria-checked
      onClick={() => onToggle(id)}
      className="h-8 px-2.5 rounded-lg border border-critical bg-critical text-white text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer"
    >
      <Check className="w-3.5 h-3.5" />
      {brigades[id]?.name ?? id}
    </button>
  ))

const ActionRow = ({ action, decided, team, onTeam, target }) => {
  const { t } = useTranslation()
  const brigades = useSelector(selectBrigadeEntities)
  const shelters = useSelector(selectShelterEntities)

  let label
  if (action.type === 'dispatch_brigade') {
    const ids = decided && action.brigades?.length ? action.brigades : action.brigade ? [action.brigade] : []
    const name = ids.map((id) => brigades[id]?.name).filter(Boolean).join(', ')
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
          <BrigadeSuggestion
            suggestion={action.suggestion}
            team={team}
            onTeam={onTeam}
            target={target}
            brigadeType={action.brigadeType}
          />
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
  // Dispatcher may pick another brigade or a whole team (null = the suggested one)
  const [team, setTeam] = useState(null)

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
      approve(team?.length ? { id: alert.id, brigadeIds: team } : alert.id),
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
                team={team}
                onTeam={setTeam}
                target={{ lat: alert.lat, lng: alert.lng }}
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
