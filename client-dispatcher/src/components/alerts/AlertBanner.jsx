import { useDispatch, useSelector } from 'react-redux'
import { useNavigate } from 'react-router'
import { useTranslation } from 'react-i18next'
import { allAlertsAcknowledged } from '@store/slices/uiSlice'
import { selectZoneById } from '@store/slices/liveSlice'
import { alertText } from '@utils'
import { Icon3D } from '../ui/Icon3D'

/**
 * Full-width solid red banner shown while there are unacknowledged new
 * critical alerts. Sits above every dashboard page.
 */
export const AlertBanner = () => {
  const dispatch = useDispatch()
  const navigate = useNavigate()
  const { t } = useTranslation()
  const incoming = useSelector((state) => state.ui.incomingAlerts)
  const alerts = useSelector((state) => state.live.alerts.entities)
  const zones = useSelector(selectZoneById)

  const pending = incoming.map((id) => alerts[id]).filter((a) => a?.status === 'active')
  if (!pending.length) return null
  const latest = pending[pending.length - 1]

  return (
    <div
      role="alert"
      className="bg-critical text-white px-5 py-2.5 flex items-center gap-3 border-b border-critical-strong"
    >
      <Icon3D name="siren" size={28} />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold uppercase tracking-wide">
          {t('alert.bannerTitle')}
          {pending.length > 1 && (
            <span className="font-medium normal-case"> · {t('alert.bannerMore', { count: pending.length - 1 })}</span>
          )}
        </p>
        <p className="text-sm truncate">{alertText(latest, zones).title}</p>
      </div>
      <button
        onClick={() => navigate('/')}
        className="h-9 px-4 rounded-lg bg-white text-critical text-sm font-bold hover:bg-[#fde8e8] cursor-pointer"
      >
        {t('alert.bannerDecide')}
      </button>
      <button
        onClick={() => dispatch(allAlertsAcknowledged())}
        className="h-9 px-3 rounded-lg border border-white/60 text-sm font-semibold hover:bg-critical-strong cursor-pointer"
      >
        {t('alert.bannerAck')}
      </button>
    </div>
  )
}
