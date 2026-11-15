import { useTranslation } from 'react-i18next'
import { clsx } from 'clsx'
import { Icon3D, Badge, StatusBadge, OccupancyBar } from '@components/ui'
import { shelterTypes } from '@constants'
import { formatDistance, formatDuration, occupancyTone, occupancyLabelKey } from '@utils'
import { FillEta } from './FillEta'

const LEVEL_ICON = { ok: 'check', busy: 'clock', full: 'alert' }

/**
 * One shelter row: type icon, name, occupancy (icon + text + colour),
 * distance / walking time, fill-time prediction.
 */
export const ShelterOption = ({ shelter, distanceMeters, durationSec, isTarget = false, onClick }) => {
  const { t } = useTranslation()
  const type = shelterTypes[shelter.type] ?? shelterTypes.shelter
  const tone = occupancyTone(shelter.occupancyRate)
  const Tag = onClick ? 'button' : 'div'

  return (
    <Tag
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      className={clsx(
        'flex w-full items-start gap-3 rounded-2xl border bg-surface p-3 text-left transition-colors',
        isTarget ? 'border-brand' : 'border-line',
        onClick && 'hover:bg-canvas'
      )}
    >
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-canvas">
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
      </div>
      <StatusBadge tone={tone} icon={LEVEL_ICON[tone]} className="self-start">
        {t(occupancyLabelKey(shelter.occupancyRate))}
      </StatusBadge>
    </Tag>
  )
}
