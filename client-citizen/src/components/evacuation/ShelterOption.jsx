import { useTranslation } from 'react-i18next'
import { clsx } from 'clsx'
import { Accessibility, Cross, Users } from 'lucide-react'
import { Icon3D, Badge, StatusBadge, OccupancyBar } from '@components/ui'
import { shelterTypes } from '@constants'
import { formatDistance, formatDuration, occupancyTone, occupancyLabelKey } from '@utils'
import { FillEta } from './FillEta'

const LEVEL_ICON = { ok: 'check', busy: 'clock', full: 'alert' }

/**
 * One shelter row: type icon, name, occupancy (icon + text + colour),
 * distance / walking time, fill-time prediction.
 */
/** Step-free entrance / medical point / people on the way — icon + text. */
const ShelterFacts = ({ shelter, unsuitable }) => {
  const { t } = useTranslation()
  const facts = []
  if (unsuitable === 'notAccessible') {
    facts.push({ Icon: Accessibility, text: t('a11yRoute.unsuitable'), cls: 'text-sos' })
  } else if (shelter.accessible === false) {
    facts.push({ Icon: Accessibility, text: t('a11yRoute.noStepFree'), cls: 'text-muted' })
  } else if (shelter.accessible) {
    facts.push({ Icon: Accessibility, text: t('a11yRoute.stepFree'), cls: 'text-info' })
  }
  if (shelter.medicalPoint) facts.push({ Icon: Cross, text: t('a11yRoute.medicalPoint'), cls: 'text-safe' })
  if (shelter.pendingArrivals > 0) {
    facts.push({ Icon: Users, text: t('balancing.onTheWay', { count: shelter.pendingArrivals }), cls: 'text-ink-soft' })
  }
  if (!facts.length) return null
  return (
    <ul className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] font-semibold">
      {facts.map(({ Icon, text, cls }) => (
        <li key={text} className={clsx('flex items-center gap-1', cls)}>
          <Icon className="h-3.5 w-3.5" aria-hidden />
          {text}
        </li>
      ))}
    </ul>
  )
}

export const ShelterOption = ({ shelter, distanceMeters, durationSec, isTarget = false, unsuitable = null, onClick }) => {
  const { t } = useTranslation()
  const type = shelterTypes[shelter.type] ?? shelterTypes.shelter
  const tone = occupancyTone(shelter.occupancyRate)
  const Tag = onClick ? 'button' : 'div'

  return (
    <Tag
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      className={clsx(
        'flex w-full items-start gap-3 rounded-3xl bg-surface p-3.5 text-left transition-colors',
        isTarget && 'ring-2 ring-brand',
        onClick && 'hover:bg-surface-strong'
      )}
    >
      <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-canvas">
        <Icon3D name={type.icon} size={30} />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="truncate text-sm font-bold text-ink">{shelter.name}</p>
          {isTarget && <Badge tone="brand">{t('shelters.target')}</Badge>}
        </div>
        <p className="mt-0.5 text-xs text-muted">
          {t(`shelters.types.${shelter.type}`)}
          {Number.isFinite(distanceMeters) && ` · ${formatDistance(distanceMeters)}`}
          {Number.isFinite(durationSec) && ` · ~${formatDuration(durationSec)}`}
        </p>
        <OccupancyBar rate={shelter.occupancyRate} className="mt-1.5" />
        <FillEta shelter={shelter} />
        <ShelterFacts shelter={shelter} unsuitable={unsuitable} />
      </div>
      <StatusBadge tone={tone} icon={LEVEL_ICON[tone]} className="self-start">
        {t(occupancyLabelKey(shelter.occupancyRate))}
      </StatusBadge>
    </Tag>
  )
}
