import { useTranslation } from 'react-i18next'
import { StatusBadge } from '@components/ui'

/**
 * Fill-time prediction: "This point will be full in ~12 min" (from live
 * inflow). Flagged when the shelter is filling fast.
 */
export const FillEta = ({ shelter, compact = false }) => {
  const { t } = useTranslation()
  if (!Number.isFinite(shelter?.fillEtaMin) || shelter.fillEtaMin <= 0) return null
  const minutes = Math.max(1, Math.round(shelter.fillEtaMin))
  return (
    <StatusBadge tone={shelter.fillingFast ? 'full' : 'busy'} icon={shelter.fillingFast ? 'fast' : 'clock'} className={compact ? '' : 'mt-2'}>
      {t('evacuation.fillEta', { min: minutes })}
      {shelter.fillingFast && ` · ${t('evacuation.fillingFast')}`}
    </StatusBadge>
  )
}
