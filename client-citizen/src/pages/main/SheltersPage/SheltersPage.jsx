import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useSelector } from 'react-redux'
import { clsx } from 'clsx'
import { Check, Clock, AlertTriangle } from 'lucide-react'

import { ShelterOption, Icon3D, EmptyState, PageLoader } from '@components'
import { useGetSheltersQuery, useGetZonesQuery } from '@store/api'
import { selectSession } from '@store/slices'
import { shelterTypes } from '@constants'
import { distanceMeters, occupancyTone } from '@utils'

const FILTERS = ['all', ...Object.keys(shelterTypes)]

/** All open assembly points with live occupancy and fill-time, nearest first. */
export const SheltersPage = () => {
  const { t, i18n } = useTranslation()
  const { origin, zoneCode } = useSelector(selectSession)
  const { data: shelters = [], isLoading } = useGetSheltersQuery()
  const { data: zones = [] } = useGetZonesQuery()
  const [filter, setFilter] = useState('all')

  const reference = origin ?? zones.find((z) => z.code === zoneCode)?.center ?? null

  const list = useMemo(() => {
    const rows = shelters
      .filter((s) => filter === 'all' || s.type === filter)
      .map((s) => ({ shelter: s, distance: reference ? distanceMeters(reference, s) : null }))
    return rows.sort((a, b) =>
      reference ? a.distance - b.distance : a.shelter.name.localeCompare(b.shelter.name, i18n.language)
    )
  }, [shelters, filter, reference, i18n.language])

  const counts = useMemo(() => {
    const c = { ok: 0, busy: 0, full: 0 }
    shelters.forEach((s) => (c[occupancyTone(s.occupancyRate)] += 1))
    return c
  }, [shelters])

  if (isLoading) return <PageLoader />

  const summary = [
    { key: 'ok', Icon: Check, cls: 'bg-safe-soft text-safe' },
    { key: 'busy', Icon: Clock, cls: 'bg-warn-soft text-warn' },
    { key: 'full', Icon: AlertTriangle, cls: 'bg-full-soft text-full' },
  ]

  return (
    <div className="stagger space-y-4">
      <div className="flex items-center gap-3">
        <Icon3D name="map" size={44} />
        <div>
          <h1 className="text-xl font-extrabold text-ink">{t('shelters.title')}</h1>
          <p className="text-sm text-muted">
            {reference ? t('shelters.nearestFirst') : t('shelters.alphabetical')} · {t('shelters.liveNote')}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2 text-center">
        {summary.map(({ key, Icon, cls }) => (
          <div key={key} className={clsx('rounded-xl px-2 py-2.5', cls)}>
            <p className="flex items-center justify-center gap-1 text-lg font-extrabold">
              <Icon className="h-4 w-4" aria-hidden /> {counts[key]}
            </p>
            <p className="text-[11px] font-bold">{t(`shelters.level.${key}`)}</p>
          </div>
        ))}
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1" role="tablist">
        {FILTERS.map((f) => (
          <button
            key={f}
            type="button"
            role="tab"
            aria-selected={filter === f}
            onClick={() => setFilter(f)}
            className={clsx(
              'flex min-h-12 shrink-0 items-center gap-1.5 rounded-full border px-3 text-sm font-semibold transition-colors',
              filter === f ? 'border-brand bg-brand text-white' : 'border-line-strong bg-surface text-ink-soft hover:bg-surface-strong'
            )}
          >
            <Icon3D name={f === 'all' ? 'map' : shelterTypes[f].icon} size={18} />
            {f === 'all' ? t('shelters.all') : t(`shelters.types.${f}`)}
          </button>
        ))}
      </div>

      {list.length === 0 ? (
        <EmptyState icon="shelter" title={t('shelters.empty')} />
      ) : (
        <div className="space-y-2">
          {list.map(({ shelter, distance }) => (
            <ShelterOption key={shelter.id} shelter={shelter} distanceMeters={distance ?? undefined} />
          ))}
        </div>
      )}
    </div>
  )
}
