import { useState } from 'react'
import { useSelector } from 'react-redux'
import { useTranslation } from 'react-i18next'
import { clsx } from 'clsx'
import {
  Users,
  Baby,
  Accessibility,
  PersonStanding,
  HeartPulse,
  ShieldAlert,
  CloudOff,
  ShieldCheck,
  Check,
  MapPin,
  Mic,
  Pin,
} from 'lucide-react'

import { useAssignSosMutation } from '@store/api'
import { useAction } from '@store/hooks'
import { selectBrigadeEntities, selectBrigades, selectZoneById } from '@store/slices/liveSlice'
import { SOS_TYPES, SOS_STATUS } from '@constants'
import { formatAgo } from '@utils'
import { useNow, useCan } from '@hooks'
import { Icon3D } from '../ui/Icon3D'
import { Badge } from '../ui/Badge'
import { StatusBadge } from '../ui/StatusBadge'
import { Button } from '../ui/Button'

const VULNERABLE_ICONS = { elderly: PersonStanding, child: Baby, disabled: Accessibility }

/** Hover / focus popover listing how the priority score was computed. */
// Minutes for an ETA in seconds (at least 1)
const etaMin = (sec) => Math.max(1, Math.round((Number(sec) || 0) / 60))

// Citizen special needs shown on the ticket (Priority #1 = limited mobility / wheelchair)
const A11Y_FLAGS = ['wheelchair', 'limitedMobility', 'speechImpaired', 'hearingImpaired', 'visionImpaired']

const PriorityScore = ({ sos, pinned }) => {
  const { t } = useTranslation()
  const breakdown = Object.entries(sos.priorityBreakdown ?? {}).filter(([, v]) => v > 0)
  return (
    <div className="relative group shrink-0">
      <button
        type="button"
        className={clsx(
          'w-14 h-14 rounded-lg border flex flex-col items-center justify-center cursor-help',
          pinned ? 'bg-critical text-white border-critical' : 'bg-panel-3 border-border-strong text-text'
        )}
        aria-label={`${t('triage.priority')} ${sos.priority}`}
      >
        <span className="text-[9px] uppercase tracking-wide opacity-80">{t('triage.priority')}</span>
        <span className="text-lg font-extrabold tabular-nums leading-none">{Math.round(sos.priority ?? 0)}</span>
      </button>
      <div
        role="tooltip"
        className="invisible opacity-0 group-hover:visible group-hover:opacity-100 group-focus-within:visible group-focus-within:opacity-100 transition-opacity absolute z-50 left-0 top-full mt-1 w-56 bg-panel-2 border border-border-strong rounded-lg p-3 text-xs"
      >
        <p className="font-semibold text-text mb-1.5">{t('triage.breakdown')}</p>
        <ul className="space-y-1">
          {breakdown.map(([key, value]) => (
            <li key={key} className="flex justify-between text-muted">
              <span>{t(`triage.breakdownKeys.${key}`, { defaultValue: key })}</span>
              <span className="text-text tabular-nums">+{value}</span>
            </li>
          ))}
        </ul>
        <p className="flex justify-between border-t border-border mt-1.5 pt-1.5 font-semibold text-text">
          <span>Σ</span>
          <span className="tabular-nums">{sos.priority}</span>
        </p>
      </div>
    </div>
  )
}

const ProfileSummary = ({ profile }) => {
  const { t } = useTranslation()
  const rows = [
    ['profileBlood', profile.bloodType],
    ['profileConditions', profile.conditions?.join(', ')],
    ['profileAllergies', profile.allergies?.join(', ')],
    ['profileMedications', profile.medications?.join(', ')],
    [
      'profileContacts',
      profile.emergencyContacts?.[0]
        ? `${profile.emergencyContacts[0].name} ${profile.emergencyContacts[0].phone}`
        : null,
    ],
  ].filter(([, v]) => v)
  if (!rows.length) return null
  return (
    <div className="mt-2 rounded-lg border border-info/40 bg-info-soft px-2.5 py-2 text-xs">
      <p className="font-semibold text-info flex items-center gap-1.5">
        <HeartPulse className="w-3.5 h-3.5" /> {t('triage.profile')}
        {profile.fullName && <span className="text-text font-medium">· {profile.fullName}</span>}
      </p>
      <dl className="mt-1 grid grid-cols-[auto_1fr] gap-x-2 gap-y-0.5">
        {rows.map(([key, value]) => (
          <div key={key} className="contents">
            <dt className="text-muted">{t(`triage.${key}`)}</dt>
            <dd className="text-text">{value}</dd>
          </div>
        ))}
      </dl>
    </div>
  )
}

/**
 * One SOS ticket in the triage queue: priority score (with breakdown),
 * indicators (headcount, vulnerable, injuries, needs, spam, offline),
 * medical profile, recommended brigade + one-click Confirm.
 */
export const TriageItem = ({ sos, profile, pinned = false, onFocus }) => {
  const { t } = useTranslation()
  const now = useNow(15000)
  const run = useAction()
  const canAssign = useCan('sos:assign')
  const brigades = useSelector(selectBrigadeEntities)
  const allBrigades = useSelector(selectBrigades)
  const zones = useSelector(selectZoneById)
  const [assign, { isLoading }] = useAssignSosMutation()
  const [other, setOther] = useState('')

  const type = SOS_TYPES[sos.type] ?? SOS_TYPES.general
  const recommended = sos.recommendedBrigade ? brigades[sos.recommendedBrigade] : null
  const assigned = sos.brigade ? brigades[sos.brigade] : null
  const available = allBrigades.filter((b) => b.status === 'available')
  const vulnerable = Object.entries(sos.vulnerable ?? {}).filter(([, v]) => v)

  const confirm = async (brigadeId) => {
    const brigadeName = brigadeId ? brigades[brigadeId]?.name : recommended?.name
    const res = await run(assign({ id: sos.id, brigadeId }), 'toast.sosAssigned', {
      brigade: brigadeName ?? t('app.none'),
    })
    if (res) setOther('')
  }

  return (
    <article
      className={clsx(
        'rounded-xl border p-3',
        pinned ? 'border-critical border-l-4 bg-critical-soft' : 'border-border bg-panel',
        sos.spamFlagged && 'opacity-70 border-dashed'
      )}
    >
      {pinned && (
        <p className="mb-2 text-[10px] font-bold uppercase tracking-wide text-critical flex items-center gap-1">
          <Pin className="w-3 h-3" /> {t('triage.pinned')}
        </p>
      )}
      <div className="flex items-start gap-3">
        <PriorityScore sos={sos} pinned={pinned} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <Icon3D name={type.icon} size={22} />
            <span className="font-semibold text-sm">{t(`sosType.${sos.type}`)}</span>
            <StatusBadge size="sm" meta={SOS_STATUS[sos.status]} label={t(`sosStatus.${sos.status}`)} />
            <span className="ml-auto text-[11px] text-subtle">{formatAgo(sos.createdAt, now)}</span>
          </div>
          <p className="text-xs text-muted mt-0.5 flex items-center gap-1">
            {zones[sos.zone]?.name ?? t('app.none')}
            {onFocus && (
              <button
                onClick={() => onFocus(sos)}
                className="inline-flex items-center gap-0.5 text-info hover:underline cursor-pointer ml-1"
              >
                <MapPin className="w-3 h-3" /> {t('app.onMap')}
              </button>
            )}
          </p>

          <div className="flex flex-wrap gap-1 mt-2">
            {sos.priorityOne && (
              <Badge size="sm" variant="critical" className="font-extrabold">
                <Accessibility className="w-3 h-3" /> {t('a11yTriage.priorityOne')}
              </Badge>
            )}
            {A11Y_FLAGS.filter((f) => sos.accessibility?.[f]).map((f) => (
              <Badge key={f} size="sm" variant="info">
                <Accessibility className="w-3 h-3" /> {t(`a11yTriage.flag.${f}`)}
              </Badge>
            ))}
            <Badge size="sm" variant={sos.headcount > 1 ? 'warning' : 'neutral'}>
              <Users className="w-3 h-3" /> {t('triage.headcount', { count: sos.headcount ?? 1 })}
            </Badge>
            {vulnerable.map(([flag]) => {
              const Icon = VULNERABLE_ICONS[flag]
              return (
                <Badge key={flag} size="sm" variant="critical">
                  {Icon && <Icon className="w-3 h-3" />} {t(`vulnerable.${flag}`)}
                </Badge>
              )
            })}
            {sos.injuries && (
              <Badge size="sm" variant="critical">
                <HeartPulse className="w-3 h-3" /> {t('triage.injuries')}
              </Badge>
            )}
            {(sos.needs ?? []).map((n) => (
              <Badge key={n} size="sm" variant="info">
                {t(`needs.${n}`, { defaultValue: n })}
              </Badge>
            ))}
            {sos.spamFlagged && (
              <Badge size="sm" variant="neutral">
                <ShieldAlert className="w-3 h-3" /> {t('triage.spam')}
                {sos.spamFlags?.length > 0 &&
                  ` · ${sos.spamFlags.map((f) => t(`triage.spamFlags.${f}`, { defaultValue: f })).join(', ')}`}
              </Badge>
            )}
            {sos.queuedOffline && (
              <Badge size="sm" variant="neutral">
                <CloudOff className="w-3 h-3" /> {t('triage.queuedOffline')}
              </Badge>
            )}
            {sos.citizenSafe && (
              <Badge size="sm" variant="success">
                <ShieldCheck className="w-3 h-3" /> {t('triage.citizenSafe')}
              </Badge>
            )}
          </div>

          {sos.injuries && <p className="text-xs text-text mt-1.5">{sos.injuries}</p>}
          {sos.transcript && (
            <p className="text-xs text-muted mt-1.5 flex items-start gap-1">
              <Mic className="w-3.5 h-3.5 shrink-0 mt-px" />
              <span>
                <span className="text-subtle">{t('triage.transcript')}:</span> “{sos.transcript}”
              </span>
            </p>
          )}
          {sos.note && !sos.transcript && (
            <p className="text-xs text-muted mt-1">
              <span className="text-subtle">{t('triage.note')}:</span> {sos.note}
            </p>
          )}

          {profile && <ProfileSummary profile={profile} />}

          {/* Assignment */}
          <div className="mt-2.5 pt-2.5 border-t border-border/70">
            {sos.status === 'assigned' ? (
              <p className="text-xs text-warning flex items-center gap-1.5">
                <Icon3D name="fireEngine" size={18} />
                {t('triage.assigned', { name: assigned?.name ?? t('app.none') })}
              </p>
            ) : (
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-xs text-muted flex items-center gap-1.5 flex-1 min-w-40">
                  {recommended ? (
                    <>
                      <Icon3D name="fireEngine" size={18} />
                      <span className="text-text">{t('triage.recommended', { name: recommended.name })}</span>
                      {sos.brigadeSuggestion?.suggestion && (
                        <Badge size="sm" variant="info">
                          {t('suggest.eta', { minutes: etaMin(sos.brigadeSuggestion.suggestion.etaSec) })}
                        </Badge>
                      )}
                    </>
                  ) : sos.brigadeSuggestion?.noneAvailable && sos.brigadeSuggestion.soonestFree ? (
                    <span className="text-warning font-medium">
                      {t('suggest.noneFree', {
                        name: sos.brigadeSuggestion.soonestFree.name,
                        free: etaMin(sos.brigadeSuggestion.soonestFree.freeInSec),
                        eta: etaMin(sos.brigadeSuggestion.soonestFree.etaSec),
                      })}
                    </span>
                  ) : (
                    t('triage.noRecommendation')
                  )}
                </p>
                {canAssign && (
                  <>
                    {recommended && (
                      <Button
                        size="sm"
                        variant="critical"
                        loading={isLoading && !other}
                        onClick={() => confirm(undefined)}
                        leftIcon={<Check className="w-3.5 h-3.5" />}
                      >
                        {t('triage.confirm')}
                      </Button>
                    )}
                    <select
                      aria-label={t('triage.assignOther')}
                      value={other}
                      onChange={(e) => {
                        setOther(e.target.value)
                        if (e.target.value) confirm(e.target.value)
                      }}
                      disabled={isLoading || available.length === 0}
                      className="h-8 rounded-lg bg-panel-2 border border-border px-2 text-xs text-text"
                    >
                      <option value="">{t('triage.assignOther')}</option>
                      {available.map((b) => (
                        <option key={b.id} value={b.id}>
                          {b.name} · {t(`brigadeType.${b.type}`)}
                        </option>
                      ))}
                    </select>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </article>
  )
}
