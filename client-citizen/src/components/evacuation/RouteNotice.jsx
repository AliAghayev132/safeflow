import { useTranslation } from 'react-i18next'
import { Navigation2, AlertTriangle } from 'lucide-react'
import { formatDistance } from '@utils'

/**
 * Routing degraded gracefully:
 *   - approximate (straight line): direction + distance only
 *   - fallback (simulated graph instead of the external API): short notice
 */
export const RouteNotice = ({ route, routing }) => {
  const { t } = useTranslation()
  if (!route) return null

  if (route.approximate || routing?.approximate) {
    return (
      <div role="status" className="flex items-start gap-3 rounded-2xl border-2 border-warn bg-warn-soft p-3">
        <span
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-warn text-white"
          aria-hidden
        >
          <Navigation2 className="h-5 w-5" style={{ transform: `rotate(${route.bearing ?? 0}deg)` }} />
        </span>
        <div>
          <p className="text-sm font-extrabold text-warn">{t('evacuation.approximateTitle')}</p>
          <p className="mt-0.5 text-sm font-medium text-ink-soft">
            {t('evacuation.approximateDesc', {
              compass: t(`compass.${route.compass ?? 'N'}`),
              distance: formatDistance(route.distanceMeters),
            })}
          </p>
        </div>
      </div>
    )
  }

  if (routing?.fallback) {
    return (
      <p role="status" className="flex items-center gap-2 rounded-xl bg-info-soft px-3 py-2 text-xs font-semibold text-info">
        <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden />
        {t('evacuation.fallbackNotice')}
      </p>
    )
  }
  return null
}
