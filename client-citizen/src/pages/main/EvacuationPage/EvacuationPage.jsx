import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { useDispatch, useSelector } from 'react-redux'
import { Link } from 'react-router'
import { List } from 'lucide-react'

import {
  EvacuationMap,
  LocationBar,
  RerouteBanner,
  RecommendedCard,
  ShelterOption,
  RouteNotice,
  AccessibleRoutePanel,
  PlanExplanation,
  EmptyState,
  Spinner,
} from '@components'
import { useGetSheltersQuery, useGetRoadsQuery, useGetEvacuationPlanQuery } from '@store/api'
import { setOrigin, selectPlanArgs, selectSession } from '@store/slices'
import { errorMessage } from '@utils'

/**
 * Module 1 — weighted shelter recommendation (distance + occupancy + road
 * state), live occupancy / fill-time and the evacuation route, auto-updated
 * by the server. Works from the offline snapshot when disconnected.
 */
export const EvacuationPage = () => {
  const { t } = useTranslation()
  const dispatch = useDispatch()
  const { origin } = useSelector(selectSession)
  const planArgs = useSelector(selectPlanArgs)

  const { data: shelters = [] } = useGetSheltersQuery()
  const { data: roads } = useGetRoadsQuery()
  const { data: plan, isFetching, error } = useGetEvacuationPlanQuery(planArgs, { skip: !planArgs })

  const mapOrigin = origin ?? plan?.origin ?? null
  const recommended = planArgs ? plan?.recommended : null
  const others = useMemo(
    () => (plan?.options ?? []).filter((o) => o.shelter.id !== recommended?.shelter.id),
    [plan, recommended]
  )

  const handlePick = (pos) => dispatch(setOrigin({ ...pos, source: 'map' }))

  return (
    // Always phone-sized: location + recommendation → map → other options.
    <div className="stagger grid grid-cols-[minmax(0,1fr)] gap-4">
      <section className="space-y-3">
        <RerouteBanner />
        <LocationBar />
        {planArgs && <AccessibleRoutePanel plan={plan} />}

        {!planArgs && (
          <div className="rounded-3xl bg-surface">
            <EmptyState icon="compass" title={t('evacuation.emptyTitle')} description={t('evacuation.emptyDesc')} />
          </div>
        )}

        {planArgs && isFetching && !plan && (
          <div className="flex items-center justify-center gap-2 rounded-3xl bg-surface p-6 text-sm font-medium text-muted">
            <Spinner className="h-4 w-4 text-brand" /> {t('evacuation.computing')}
          </div>
        )}

        {planArgs && error && !plan && (
          <p className="rounded-2xl bg-sos-soft p-4 text-sm font-medium text-sos">{errorMessage(error)}</p>
        )}

        {planArgs && plan && !recommended && (
          <div className="rounded-3xl bg-surface">
            <EmptyState icon="warning" title={t('evacuation.noShelterTitle')} description={t('evacuation.noShelterDesc')} />
          </div>
        )}

        {recommended && <RouteNotice route={recommended.route} routing={plan?.routing} />}
        {recommended && <PlanExplanation explanation={plan?.explanation} />}
        {recommended && <RecommendedCard recommended={recommended} />}
      </section>

      <section>
        <EvacuationMap
          origin={mapOrigin}
          shelters={shelters}
          recommended={recommended}
          edges={roads?.edges}
          onPick={handlePick}
          className="h-[46vh] rounded-2xl border border-line"
        />
      </section>

      <section className="space-y-2">
        {others.length > 0 && (
          <>
            <h3 className="mt-1 text-sm font-bold text-ink">{t('evacuation.others')}</h3>
            {others.map((o) => (
              <ShelterOption
                key={o.shelter.id}
                shelter={o.shelter}
                distanceMeters={o.distanceMeters}
                durationSec={o.durationSec}
                unsuitable={o.unsuitable}
              />
            ))}
          </>
        )}
        <Link
          to="/shelters"
          className="flex h-12 items-center justify-center gap-2 rounded-full bg-surface text-sm font-bold text-ink hover:bg-surface-strong"
        >
          <List className="h-4 w-4" aria-hidden /> {t('evacuation.allShelters')}
        </Link>
      </section>
    </div>
  )
}
