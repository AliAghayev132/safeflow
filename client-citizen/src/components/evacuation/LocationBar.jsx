import { useTranslation } from 'react-i18next'
import { useDispatch, useSelector } from 'react-redux'
import { clsx } from 'clsx'
import { Crosshair, MapPin, MapPinned } from 'lucide-react'

import { Spinner } from '@components/ui'
import { useGeolocation } from '@hooks'
import { useGetZonesQuery } from '@store/api'
import { setOrigin, setZone, selectSession } from '@store/slices'
import { CITY_CENTER, SERVICE_RADIUS_METERS } from '@constants'
import { distanceMeters } from '@utils'

/**
 * Where the citizen is: GPS (round black button), district chips (no
 * native <select>), or a tap on the map.
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
  const selectedZone = originSource === 'zone' ? zoneCode : null

  return (
    <div className="space-y-3">
      {/* Location pill + GPS button */}
      <div className="flex h-16 items-center gap-3 rounded-full bg-surface pl-4 pr-2">
        <MapPin className="h-5 w-5 shrink-0 text-sos" aria-hidden />
        <div className="min-w-0 flex-1 leading-tight">
          <p className="text-[11px] font-semibold text-muted">{t('evacuation.location')}</p>
          <p className="truncate text-sm font-bold text-ink">{label}</p>
        </div>
        <button
          type="button"
          onClick={handleLocate}
          disabled={loading}
          aria-label={t('evacuation.findMe')}
          title={t('evacuation.findMe')}
          className={clsx(
            'flex h-12 shrink-0 items-center justify-center gap-2 rounded-full px-4 text-sm font-bold transition-colors',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2 disabled:opacity-70',
            originSource === 'gps' ? 'bg-canvas text-ink' : 'bg-ink text-white hover:bg-ink-soft'
          )}
        >
          {loading ? <Spinner className="h-4 w-4" /> : <Crosshair className="h-4 w-4" aria-hidden />}
          <span className="hidden min-[380px]:inline">{t('evacuation.findMe')}</span>
        </button>
      </div>

      {/* District chips */}
      <div>
        <p id="zone-chips-label" className="mb-2 flex items-center gap-1.5 px-1 text-xs font-semibold text-muted">
          {t('evacuation.chooseZone')}
          <span className="hidden items-center gap-1 sm:inline-flex">
            · <MapPinned className="h-3.5 w-3.5" aria-hidden /> {t('evacuation.orTapMap')}
          </span>
        </p>
        <div
          role="radiogroup"
          aria-labelledby="zone-chips-label"
          className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {zones.map((z) => {
            const on = selectedZone === z.code
            return (
              <button
                key={z.code}
                type="button"
                role="radio"
                aria-checked={on}
                onClick={() => dispatch(setZone(z.code))}
                className={clsx(
                  'h-12 shrink-0 rounded-full px-5 text-sm font-semibold transition-colors',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2',
                  on ? 'bg-ink text-white' : 'bg-surface text-ink hover:bg-surface-strong'
                )}
              >
                {z.name}
              </button>
            )
          })}
        </div>
      </div>

      {errorKey && (
        <p role="status" className="rounded-2xl bg-warn-soft px-4 py-3 text-xs font-medium text-warn">
          {errorKey === 'outOfArea' ? t('evacuation.outOfArea') : t(`evacuation.geo.${errorKey}`)}
        </p>
      )}
    </div>
  )
}
