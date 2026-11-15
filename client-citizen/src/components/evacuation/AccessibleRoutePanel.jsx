import { useTranslation } from 'react-i18next'
import { useDispatch, useSelector } from 'react-redux'
import { Accessibility, ShieldCheck, AlertTriangle } from 'lucide-react'
import { clsx } from 'clsx'

import { useFeature } from '@hooks'
import { setAccessibleRoute, selectSession } from '@store/slices'

const BARRIERS = ['stairs', 'steepSlope', 'obstacle', 'damaged', 'damageZone']

/**
 * Barrier-free routing for wheelchair users and medical transport: switch +
 * what the route avoided (stairs, steep slopes, obstacles, damaged segments,
 * structural-damage zones). Turned on automatically by the profile's
 * limited-mobility / wheelchair needs (plan.needs.accessible).
 */
export const AccessibleRoutePanel = ({ plan }) => {
  const { t } = useTranslation()
  const dispatch = useDispatch()
  const enabled = useFeature('accessibleRouting')
  const { accessibleRoute } = useSelector(selectSession)
  if (!enabled) return null

  const active = Boolean(plan?.needs?.accessible)
  const fromProfile = active && !accessibleRoute
  const routing = plan?.routing
  const avoided = routing?.barriersAvoided ?? {}
  const avoidedList = BARRIERS.filter((k) => avoided[k] > 0)

  return (
    <section
      aria-labelledby="a11y-route-title"
      className={clsx('rounded-2xl border-2 p-3', active ? 'border-info bg-info-soft' : 'border-line bg-surface')}
    >
      <div className="flex items-center gap-3">
        <span
          className={clsx(
            'flex h-11 w-11 shrink-0 items-center justify-center rounded-full',
            active ? 'bg-info text-white' : 'bg-canvas text-ink-soft'
          )}
          aria-hidden
        >
          <Accessibility className="h-6 w-6" />
        </span>
        <div className="min-w-0 flex-1">
          <p id="a11y-route-title" className="text-sm font-extrabold text-ink">
            {t('a11yRoute.title')}
          </p>
          <p className="text-xs text-muted">{fromProfile ? t('a11yRoute.fromProfile') : t('a11yRoute.hint')}</p>
        </div>
        <label className="inline-flex min-h-12 min-w-12 cursor-pointer items-center justify-center">
          <span className="sr-only">{t('a11yRoute.toggle')}</span>
          <input
            type="checkbox"
            role="switch"
            className="peer sr-only"
            checked={active}
            disabled={fromProfile}
            onChange={(e) => dispatch(setAccessibleRoute(e.target.checked))}
          />
          <span
            aria-hidden
            className="relative h-7 w-12 rounded-full bg-line-strong transition-colors peer-checked:bg-info peer-focus-visible:ring-2 peer-focus-visible:ring-brand peer-focus-visible:ring-offset-2 peer-disabled:opacity-70 after:absolute after:left-1 after:top-1 after:h-5 after:w-5 after:rounded-full after:bg-white after:transition-transform peer-checked:after:translate-x-5"
          />
        </label>
      </div>

      {active && routing && (
        <div className="mt-2 border-t border-info/30 pt-2 text-xs font-semibold">
          {routing.accessibleUnverified ? (
            <p className="flex items-start gap-1.5 text-warn" role="status">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
              {t('a11yRoute.unverified')}
            </p>
          ) : (
            <p className="flex items-start gap-1.5 text-info" role="status">
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
              {avoidedList.length
                ? t('a11yRoute.avoided', {
                    list: avoidedList.map((k) => t(`a11yRoute.barrier.${k}`, { count: avoided[k] })).join(', '),
                  })
                : t('a11yRoute.clear')}
            </p>
          )}
        </div>
      )}
    </section>
  )
}
