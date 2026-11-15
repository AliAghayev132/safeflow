import { useTranslation } from 'react-i18next'
import { useSelector } from 'react-redux'
import { Link } from 'react-router'
import { MapPin, Navigation } from 'lucide-react'

import { useGetZonesQuery, useGetEvacuationPlanQuery } from '@store/api'
import { selectSession, selectPlanArgs } from '@store/slices'

/** "Current location" pill at the top of the SOS screen (+ shortcut to evacuation). */
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
    <div className="flex h-16 items-center gap-3 rounded-full bg-surface pl-4 pr-2">
      <MapPin className="h-5 w-5 shrink-0 text-sos" aria-hidden />
      <div className="min-w-0 flex-1 leading-tight">
        <p className="text-[11px] font-semibold text-muted">{t('sos.locationLabel')}</p>
        <p className="truncate text-sm font-bold text-ink">{label}</p>
      </div>
      <Link
        to="/evacuation"
        aria-label={t('nav.evacuation')}
        className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-ink text-white transition-colors hover:bg-ink-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2"
      >
        <Navigation className="h-5 w-5" aria-hidden />
      </Link>
    </div>
  )
}
