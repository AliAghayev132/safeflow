// React
import { useMemo, useState } from 'react'

// Redux
import { useSelector } from 'react-redux'
import { selectTriageQueue, selectProfiles } from '@store/slices/liveSlice'
import { useGetQueueQuery } from '@store/api'

// i18n
import { useTranslation } from 'react-i18next'

// Components
import { Card, EmptyState, OperationsMap, TriageItem, StatCard } from '@components'

const FILTERS = [
  { key: 'all', match: () => true },
  { key: 'pending', match: (s) => s.status === 'pending' && !s.spamFlagged },
  { key: 'assigned', match: (s) => s.status === 'assigned' },
  { key: 'spam', match: (s) => s.spamFlagged },
]

/**
 * Full triage queue: every open SOS ranked by priority score (highest pinned
 * on top), with filters and a focus map.
 */
export const TriagePage = () => {
  const { t } = useTranslation()
  // Refresh profiles / server-side priorities periodically
  useGetQueueQuery(undefined, { pollingInterval: 30000 })
  const queue = useSelector(selectTriageQueue)
  const profiles = useSelector(selectProfiles)
  const [filter, setFilter] = useState('all')
  const [focus, setFocus] = useState(null)

  const rows = useMemo(() => queue.filter(FILTERS.find((f) => f.key === filter).match), [queue, filter])
  const counts = Object.fromEntries(FILTERS.map((f) => [f.key, queue.filter(f.match).length]))
  const vulnerable = queue.filter((s) => Object.values(s.vulnerable ?? {}).some(Boolean)).length
  const people = queue.reduce((sum, s) => sum + (s.headcount ?? 1), 0)

  return (
    <div className="p-4 space-y-4">
      <div className="grid gap-3 grid-cols-[repeat(auto-fit,minmax(180px,1fr))]">
        <StatCard icon="sos" title={t('triage.filterPending')} value={counts.pending} tone={counts.pending ? 'critical' : 'neutral'} />
        <StatCard icon="fireEngine" title={t('triage.filterAssigned')} value={counts.assigned} />
        <StatCard icon="people" title={t('triage.breakdownKeys.headcount')} value={people} />
        <StatCard icon="hospital" title={t('triage.breakdownKeys.vulnerable')} value={vulnerable} tone={vulnerable ? 'warning' : 'neutral'} />
        <StatCard icon="warning" title={t('triage.filterSpam')} value={counts.spam} />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            aria-pressed={filter === f.key}
            className={`h-9 px-3 rounded-lg text-sm font-medium border cursor-pointer ${
              filter === f.key
                ? 'bg-panel-3 border-border-strong text-text'
                : 'bg-panel border-border text-muted hover:text-text'
            }`}
          >
            {t(`triage.filter${f.key[0].toUpperCase()}${f.key.slice(1)}`)}
            <span className="ml-2 text-xs text-subtle tabular-nums">{counts[f.key]}</span>
          </button>
        ))}
        <p className="ml-auto text-xs text-muted">{t('triage.subtitle')}</p>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_480px] gap-4 items-start">
        <div className="space-y-2 min-w-0">
          {rows.length === 0 ? (
            <Card>
              <EmptyState icon="safe" title={t('triage.empty')} description={t('triage.emptyHint')} />
            </Card>
          ) : (
            rows.map((s, i) => (
              <TriageItem
                key={s.id}
                sos={s}
                profile={profiles[s.deviceId]}
                pinned={filter === 'all' && i === 0}
                onFocus={(item) => setFocus({ lat: item.lat, lng: item.lng, at: Date.now() })}
              />
            ))
          )}
        </div>
        <Card padding="none" className="overflow-hidden h-[70vh] xl:sticky xl:top-4">
          <OperationsMap layers={{ zones: false, alerts: false, heatmap: true }} focus={focus} />
        </Card>
      </div>
    </div>
  )
}
