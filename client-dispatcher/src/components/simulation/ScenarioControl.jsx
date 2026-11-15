import { useSelector } from 'react-redux'
import { useTranslation } from 'react-i18next'
import { clsx } from 'clsx'
import { Play, Square, CircleCheck, Hourglass, Loader2, Ban } from 'lucide-react'

import {
  useGetScenariosQuery,
  useStartScenarioMutation,
  useStopScenarioMutation,
} from '@store/api'
import { useAction } from '@store/hooks'
import { selectScenario } from '@store/slices/liveSlice'
import { Icon3D } from '../ui/Icon3D'
import { Button } from '../ui/Button'
import { ProgressBar } from '../ui/ProgressBar'
import { StatusBadge } from '../ui/StatusBadge'

const PRIMARY = 'earthquake_yasamal'

const STATUS_META = {
  running: { variant: 'critical', Icon: Loader2 },
  finished: { variant: 'success', Icon: CircleCheck },
  stopped: { variant: 'neutral', Icon: Ban },
  idle: { variant: 'info', Icon: Hourglass },
}

/** Translation key for a scenario title (server sends `scenario.xxx`). */
const titleKey = (s) => s?.titleKey ?? `scenario.${s?.id}`

/**
 * Hackathon demo control: 1-click "Earthquake in Yasamal" start / stop with
 * live progress (tick, SOS, spam, shelter arrivals, closed roads).
 * Rendered only for users with simulation:run.
 */
export const ScenarioControl = ({ className }) => {
  const { t } = useTranslation()
  const run = useAction()
  const { data } = useGetScenariosQuery()
  const live = useSelector(selectScenario)
  const [start, { isLoading: starting }] = useStartScenarioMutation()
  const [stop, { isLoading: stopping }] = useStopScenarioMutation()

  const scenarios = data?.scenarios ?? []
  const state = live ?? data?.status ?? null
  const running = state?.status === 'running'
  const statusKey = state?.status ?? 'idle'
  const progress = state?.ticks ? state.tick / state.ticks : 0
  const others = scenarios.filter((s) => s.id !== PRIMARY)

  return (
    <section
      className={clsx(
        'rounded-xl border px-4 py-3 flex flex-wrap items-center gap-x-4 gap-y-2',
        running ? 'bg-critical-soft border-critical' : 'bg-panel border-border',
        className
      )}
    >
      <div className="flex items-center gap-2.5 min-w-0">
        <Icon3D name="collapse" size={32} />
        <div className="min-w-0">
          <p className="text-[11px] uppercase tracking-wide text-muted font-semibold">{t('scenario.title')}</p>
          <p className="text-sm font-semibold truncate">
            {state ? t(titleKey(state)) : t('scenario.earthquakeYasamal')}
          </p>
        </div>
      </div>

      <StatusBadge meta={STATUS_META[statusKey]} label={t(`scenario.${statusKey}`)} spin={running} />

      {state && (
        <div className="flex-1 min-w-56">
          <div className="flex justify-between text-xs text-muted mb-1 gap-2">
            <span>{t('scenario.progress', { tick: state.tick, ticks: state.ticks })}</span>
            <span className="truncate">
              {t('scenario.stats', {
                sos: state.stats?.sos ?? 0,
                spam: state.stats?.spam ?? 0,
                arrivals: state.stats?.arrivals ?? 0,
                roads: state.stats?.roadsClosed ?? 0,
              })}
            </span>
          </div>
          <ProgressBar value={progress} color={running ? '#E5484D' : '#30A46C'} height={6} />
        </div>
      )}

      <div className="flex items-center gap-2 ml-auto">
        {running ? (
          <Button
            variant="outline"
            size="sm"
            loading={stopping}
            onClick={() => run(stop(), 'toast.scenarioStopped')}
            leftIcon={<Square className="w-3.5 h-3.5" />}
          >
            {t('scenario.stop')}
          </Button>
        ) : (
          <>
            <Button
              variant="critical"
              size="sm"
              loading={starting}
              onClick={() => run(start(PRIMARY), 'toast.scenarioStarted')}
              leftIcon={<Play className="w-3.5 h-3.5" />}
            >
              {t('scenario.earthquakeYasamal')}
            </Button>
            {others.map((s) => (
              <Button
                key={s.id}
                variant="secondary"
                size="sm"
                disabled={starting}
                onClick={() => run(start(s.id), 'toast.scenarioStarted')}
                leftIcon={<Play className="w-3.5 h-3.5" />}
              >
                {t(titleKey(s))}
              </Button>
            ))}
          </>
        )}
      </div>
    </section>
  )
}
