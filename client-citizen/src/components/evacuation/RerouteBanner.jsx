import { useTranslation } from 'react-i18next'
import { useDispatch, useSelector } from 'react-redux'
import { X } from 'lucide-react'

import { Icon3D } from '@components/ui'
import { dismissRerouteNotice } from '@store/slices'
import { rerouteIcons } from '@constants'
import { formatTime, formatPercent } from '@utils'

/**
 * Shown when the server pushed an automatic alternative route
 * (road closed / shelter full / new shelter opened).
 */
export const RerouteBanner = () => {
  const { t } = useTranslation()
  const dispatch = useDispatch()
  const notice = useSelector((s) => s.session.rerouteNotice)
  if (!notice) return null

  const reason = rerouteIcons[notice.reason] ? notice.reason : 'road_closed'
  const ctx = notice.context ?? {}
  const named = ctx.roadName || ctx.shelterName
  const desc = named
    ? t(`reroute.${reason}.descNamed`, {
        road: ctx.roadName,
        shelter: ctx.shelterName,
        percent: formatPercent(ctx.occupancyRate ?? 0.9),
      })
    : t(`reroute.${reason}.desc`)
  const isOpened = reason === 'shelter_opened'

  return (
    <div
      role="alert"
      className={`animate-slide-down flex items-start gap-3 rounded-2xl p-3 text-white ${isOpened ? 'bg-safe' : 'bg-sos'}`}
    >
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white">
        <Icon3D name={rerouteIcons[reason]} size={30} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-bold">{t(`reroute.${reason}.title`)}</p>
        <p className="mt-0.5 text-sm text-white/90">{desc}</p>
        <p className="mt-1 text-xs font-semibold text-white/80">
          {notice.shelterName ? t('reroute.newTarget', { name: notice.shelterName }) : t('reroute.noTarget')}
          {' · '}
          {formatTime(notice.at)}
        </p>
      </div>
      <button
        type="button"
        onClick={() => dispatch(dismissRerouteNotice())}
        className="rounded-lg p-1 text-white/90 hover:bg-white/15"
        aria-label={t('common.close')}
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  )
}
