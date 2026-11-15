import { useTranslation } from 'react-i18next'
import { useDispatch, useSelector } from 'react-redux'
import { Crosshair, MapPinned } from 'lucide-react'

import { Button, Icon3D } from '@components/ui'
import { useGeolocation } from '@hooks'
import { useGetZonesQuery } from '@store/api'
import { setOrigin, setZone, selectSession } from '@store/slices'
import { CITY_CENTER, SERVICE_RADIUS_METERS } from '@constants'
import { distanceMeters } from '@utils'

/**
 * Where the citizen is: GPS, district select, or a tap on the map.
 */
export const LocationBar = () => {
  const { t } = useTranslation()
  const dispatch = useDispatch()
  const { origin, originSource, zoneCode } = useSelector(selectSession)
  const { data: zones = [] } = useGetZonesQuery()
  const { locate, loading, errorKey, setErrorKey } = useGeolocation()

  const handleLocate = async () => {
    const pos = await locate()
    if (!pos) return
    if (distanceMeters(pos, CITY_CENTER) > SERVICE_RADIUS_METERS) {
      setErrorKey('outOfArea')
      return
    }
    dispatch(setOrigin({ ...pos, source: 'gps' }))
  }

  const zoneName = zones.find((z) => z.code === zoneCode)?.name
  const label =
    originSource === 'zone' && zoneName
      ? t('evacuation.zoneName', { zone: zoneName })
      : origin
        ? t(`evacuation.source.${originSource}`)
        : t('evacuation.notSelected')

  return (
    <div className="rounded-2xl border border-line bg-surface p-3">
      <div className="flex items-center gap-3">
        <Icon3D name="pin" size={36} />
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted">{t('evacuation.location')}</p>
          <p className="truncate text-sm font-bold text-ink">{label}</p>
        </div>
        <Button
          size="sm"
          variant={originSource === 'gps' ? 'outline' : 'primary'}
          onClick={handleLocate}
          loading={loading}
          leftIcon={<Crosshair className="h-4 w-4" />}
        >
          {t('evacuation.findMe')}
        </Button>
      </div>

      <div className="mt-3 flex items-center gap-2">
        <label htmlFor="zone-select" className="sr-only">
          {t('evacuation.chooseZone')}
        </label>
        <select
          id="zone-select"
          value={originSource === 'zone' ? (zoneCode ?? '') : ''}
          onChange={(e) => e.target.value && dispatch(setZone(e.target.value))}
          className="h-11 min-w-0 flex-1 rounded-xl border border-line-strong bg-surface px-3 text-sm font-medium text-ink focus:border-brand focus:outline-none"
        >
          <option value="">{t('evacuation.chooseZone')}</option>
          {zones.map((z) => (
            <option key={z.code} value={z.code}>
              {z.name}
            </option>
          ))}
        </select>
        <span className="hidden items-center gap-1 text-xs text-muted sm:flex">
          <MapPinned className="h-3.5 w-3.5" /> {t('evacuation.orTapMap')}
        </span>
      </div>

      {errorKey && (
        <p className="mt-2 rounded-lg bg-warn-soft px-3 py-2 text-xs font-medium text-warn">
          {errorKey === 'outOfArea' ? t('evacuation.outOfArea') : t(`evacuation.geo.${errorKey}`)}
        </p>
      )}
    </div>
  )
}
