import { clsx } from 'clsx'
import { useTranslation } from 'react-i18next'
import { occupancyTone, occupancyColors, formatPercent } from '@utils'

/** Solid occupancy bar with a 90% "full" marker. */
export const OccupancyBar = ({ rate = 0, showLabel = true, className }) => {
  const { t } = useTranslation()
  const tone = occupancyTone(rate)
  const pct = Math.min(100, Math.max(0, Math.round(rate * 100)))

  return (
    <div className={clsx('flex items-center gap-2', className)}>
      <div
        className="relative h-2.5 flex-1 overflow-hidden rounded-full bg-line"
        role="meter"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={pct}
        aria-label={t('evacuation.currentOccupancy')}
      >
        <div
          className={clsx('h-full rounded-full transition-[width] duration-500', occupancyColors[tone].bar)}
          style={{ width: `${pct}%` }}
        />
        <span className="absolute top-0 h-full w-0.5 bg-ink/50" style={{ left: '90%' }} />
      </div>
      {showLabel && (
        <span className={clsx('w-11 text-right text-sm font-extrabold tabular-nums', occupancyColors[tone].text)}>
          {formatPercent(rate)}
        </span>
      )}
    </div>
  )
}
