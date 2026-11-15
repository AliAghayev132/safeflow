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
    <Card padding="sm" className="space-y-3">
      {/* Solid blue summary (like an "upcoming" card) */}
      <div className="rounded-[22px] bg-brand p-4 text-white">
        <div className="flex items-center justify-between gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-xs font-bold">
            <Navigation className="h-3.5 w-3.5" aria-hidden />
            {t('evacuation.recommended')}
          </span>
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-white">
            <Icon3D name={type.icon} size={30} />
          </span>
        </div>
        <p className="mt-3 text-xl font-extrabold leading-snug">{shelter.name}</p>
        <p className="mt-0.5 text-sm text-white/85">
          {t(`shelters.types.${shelter.type}`)} · {shelter.address}
        </p>
        <div className="mt-4 flex items-end gap-6">
          <div>
            <p className="flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wide text-white/80">
              <Footprints className="h-3.5 w-3.5" aria-hidden /> {t('evacuation.distance')}
            </p>
            <p className="text-2xl font-extrabold tabular-nums">{formatDistance(route.distanceMeters)}</p>
          </div>
          <div>
            <p className="flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wide text-white/80">
              <Clock className="h-3.5 w-3.5" aria-hidden /> {t('evacuation.walking')}
            </p>
            <p className="text-2xl font-extrabold tabular-nums">~{formatDuration(route.durationSec)}</p>
          </div>
        </div>
        <p className="mt-3 text-[11px] font-medium text-white/80">{t('evacuation.recommendedWhy')}</p>
      </div>

      <div className="px-2 pb-1">
        <div className="rounded-2xl bg-canvas p-3">
          <div className="mb-1.5 flex items-center justify-between text-xs font-semibold text-muted">
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

        <div className="mt-4 flex items-center justify-between">
          <span className="text-xs font-semibold text-muted">{t('evacuation.yourStatus')}</span>
          <StatusBadge tone={statusMeta.tone} icon={statusMeta.icon}>
            {t(`citizenStatus.${status}`)}
          </StatusBadge>
        </div>

        <div className="mt-3 grid gap-2">
          {status === 'safe' ? (
            <div className="flex items-center gap-2 rounded-full bg-safe-soft px-4 py-3 text-sm font-semibold text-safe">
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
