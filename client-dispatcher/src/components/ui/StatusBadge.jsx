import { useTranslation } from 'react-i18next'
import { Badge } from './Badge'

/**
 * Status = colour + icon + text, never colour alone (colour-blind safe).
 *   <StatusBadge meta={SOS_STATUS[s.status]} label={t(`sosStatus.${s.status}`)} />
 */
export const StatusBadge = ({ meta, label, size = 'md', className, spin = false }) => {
  const { t } = useTranslation()
  const Icon = meta?.Icon
  return (
    <Badge variant={meta?.variant ?? 'neutral'} size={size} className={className}>
      {Icon && <Icon className={`${size === 'sm' ? 'w-3 h-3' : 'w-3.5 h-3.5'} ${spin ? 'animate-spin' : ''}`} aria-hidden />}
      {label ?? t('app.none')}
    </Badge>
  )
}
