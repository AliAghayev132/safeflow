import { useTranslation } from 'react-i18next'
import { useSelector } from 'react-redux'
import { Accessibility } from 'lucide-react'
import { useGetProfileQuery } from '@store/api'
import { selectDeviceId } from '@store/slices'

/**
 * Challenge Drop #1: shown when this device has the "priority_citizen" role
 * (limited mobility / wheelchair in the profile) — every SOS is Priority #1
 * and evacuation routes are barrier-free only.
 */
export const PriorityRoleBadge = ({ compact = false }) => {
  const { t } = useTranslation()
  const deviceId = useSelector(selectDeviceId)
  const { data: profile } = useGetProfileQuery(deviceId, { skip: !deviceId })
  if (profile?.role !== 'priority_citizen') return null

  return (
    <div role="status" className="flex items-start gap-3 rounded-3xl bg-brand p-4 text-white">
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white text-brand" aria-hidden>
        <Accessibility className="h-6 w-6" />
      </span>
      <div className="min-w-0">
        <p className="text-sm font-extrabold">{t('priorityRole.title')}</p>
        {!compact && <p className="mt-0.5 text-xs font-medium text-white/90">{t('priorityRole.desc')}</p>}
      </div>
    </div>
  )
}
