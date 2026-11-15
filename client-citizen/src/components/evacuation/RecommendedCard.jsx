import { useTranslation } from 'react-i18next'
import { useSelector } from 'react-redux'
import { Footprints, Clock, Navigation, CheckCircle2 } from 'lucide-react'

import { Button, Card, Icon3D, StatusBadge, OccupancyBar } from '@components/ui'
import { useGetCitizenStateQuery, useUpdateStatusMutation, useCheckInMutation } from '@store/api'
import { selectSession } from '@store/slices'
import { shelterTypes, citizenStatusMeta } from '@constants'
import { formatDistance, formatDuration, errorMessage } from '@utils'
import { FillEta } from './FillEta'

/**
 * Recommended assembly point (weighted: distance + occupancy + road state),
 * route summary, fill-time prediction and evacuation actions.
 */
export const RecommendedCard = ({ recommended }) => {
  const { t } = useTranslation()
  const { deviceId, origin } = useSelector(selectSession)
  const { data } = useGetCitizenStateQuery(deviceId)
  const [updateStatus, { isLoading: starting }] = useUpdateStatusMutation()
  const [checkIn, { isLoading: checkingIn, error: checkInError }] = useCheckInMutation()

  const status = data?.state?.status ?? 'unknown'
  const statusMeta = citizenStatusMeta[status] ?? citizenStatusMeta.unknown
  const { shelter, route } = recommended
  const type = shelterTypes[shelter.type] ?? shelterTypes.shelter

  const startEvacuation = () => updateStatus({ deviceId, status: 'evacuating', ...(origin ?? {}) })

  return (
    <Card padding="none" className="overflow-hidden">
      <div className="flex items-center gap-2 bg-brand px-4 py-2 text-white">
        <Navigation className="h-4 w-4" aria-hidden />
        <span className="text-xs font-bold uppercase tracking-wide">{t('evacuation.recommended')}</span>
      </div>

      <div className="p-4">
        <div className="flex items-start gap-3">
          <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-brand-soft">
            <Icon3D name={type.icon} size={40} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-base font-bold leading-snug text-ink">{shelter.name}</p>
            <p className="mt-0.5 text-sm text-muted">
              {t(`shelters.types.${shelter.type}`)} · {shelter.address}
            </p>
            <p className="mt-1 text-[11px] font-semibold text-muted">{t('evacuation.recommendedWhy')}</p>
          </div>
        </div>

        <div className="mt-4">
          <div className="mb-1 flex items-center justify-between text-xs font-semibold text-muted">
            <span>{t('evacuation.currentOccupancy')}</span>
            <span className="tabular-nums">
              {t('evacuation.people', {
                occupancy: shelter.occupancy.toLocaleString(),
                capacity: shelter.capacity.toLocaleString(),
              })}
            </span>
          </div>
          <OccupancyBar rate={shelter.occupancyRate} />
          <FillEta shelter={shelter} />
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2">
          <div className="flex items-center gap-2 rounded-xl bg-canvas px-3 py-2.5">
            <Footprints className="h-4 w-4 text-brand" aria-hidden />
            <div>
              <p className="text-[11px] font-semibold uppercase text-muted">{t('evacuation.distance')}</p>
              <p className="text-sm font-bold text-ink">{formatDistance(route.distanceMeters)}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 rounded-xl bg-canvas px-3 py-2.5">
            <Clock className="h-4 w-4 text-brand" aria-hidden />
            <div>
              <p className="text-[11px] font-semibold uppercase text-muted">{t('evacuation.walking')}</p>
              <p className="text-sm font-bold text-ink">~{formatDuration(route.durationSec)}</p>
            </div>
          </div>
        </div>

        <div className="mt-4 flex items-center justify-between">
          <span className="text-xs font-semibold text-muted">{t('evacuation.yourStatus')}</span>
          <StatusBadge tone={statusMeta.tone} icon={statusMeta.icon}>
            {t(`citizenStatus.${status}`)}
          </StatusBadge>
        </div>

        <div className="mt-3 grid gap-2">
          {status === 'safe' ? (
            <div className="flex items-center gap-2 rounded-xl bg-safe-soft px-3 py-3 text-sm font-semibold text-safe">
              <CheckCircle2 className="h-5 w-5" aria-hidden /> {t('evacuation.safeRegistered')}
            </div>
          ) : status === 'evacuating' ? (
            <Button variant="safe" size="lg" fullWidth loading={checkingIn} onClick={() => checkIn(deviceId)}>
              {t('evacuation.arrived')}
            </Button>
          ) : (
            <Button size="lg" fullWidth loading={starting} onClick={startEvacuation}>
              {t('evacuation.start')}
            </Button>
          )}
          {checkInError && <p className="text-xs font-medium text-sos">{errorMessage(checkInError)}</p>}
        </div>
      </div>
    </Card>
  )
}
