import { useTranslation } from 'react-i18next'
import { useSelector } from 'react-redux'
import { MapPin } from 'lucide-react'

import { Icon3D } from '@components/ui'
import { useGetZonesQuery, useGetEvacuationPlanQuery } from '@store/api'
import { selectSession, selectPlanArgs } from '@store/slices'

/** "Current location" strip at the top of the SOS screen. */
export const LocationHeader = () => {
  const { t } = useTranslation()
  const { origin, originSource, zoneCode } = useSelector(selectSession)
  const planArgs = useSelector(selectPlanArgs)
  const { data: zones = [] } = useGetZonesQuery()
  const { data: plan } = useGetEvacuationPlanQuery(planArgs, { skip: !planArgs })

  const zoneName = plan?.zone?.name ?? zones.find((z) => z.code === zoneCode)?.name
  let label = t('sos.locationUnknown')
  if (zoneName) label = t('sos.locationZone', { zone: zoneName })
  else if (origin && originSource === 'gps') {
    label = t('sos.locationGps', { lat: origin.lat.toFixed(4), lng: origin.lng.toFixed(4) })
  } else if (origin) label = t('sos.locationMap')

  return (
    <div className="flex items-center gap-3 rounded-2xl border border-line bg-surface px-3 py-2.5">
      <Icon3D name="pin" size={34} />
      <div className="min-w-0 flex-1 leading-tight">
        <p className="text-xs font-semibold text-muted">{t('sos.locationLabel')}</p>
        <p className="flex items-center gap-1 truncate text-sm font-bold text-ink">
          <MapPin className="h-3.5 w-3.5 shrink-0 text-sos" aria-hidden />
          <span className="truncate">{label}</span>
        </p>
      </div>
    </div>
  )
}
