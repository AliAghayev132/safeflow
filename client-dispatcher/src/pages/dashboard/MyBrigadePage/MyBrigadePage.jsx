// Redux
import { useSelector } from 'react-redux'
import { selectBrigadeById } from '@store/slices/liveSlice'
import { useGetMyBrigadeQuery, useUpdateBrigadeStatusMutation } from '@store/api'
import { useAction } from '@store/hooks'

// i18n
import { useTranslation } from 'react-i18next'

// Components
import {
  Card,
  Button,
  Icon3D,
  EmptyState,
  PageLoader,
  StatusBadge,
  TriageItem,
  AlertCard,
  OperationsMap,
} from '@components'

// Constants / utils
import { BRIGADE_TYPES, BRIGADE_STATUS, BRIGADE_TRANSITIONS } from '@constants'
import { formatAgo, errorText } from '@utils'
import { useNow } from '@hooks'

/**
 * Brigade lead view (permission brigade:update_own): own brigade, its live
 * status, assigned SOS tasks / linked alert and allowed status changes.
 */
export const MyBrigadePage = () => {
  const { t } = useTranslation()
  const now = useNow(15000)
  const run = useAction()
  const { data, isLoading, error } = useGetMyBrigadeQuery(undefined, { pollingInterval: 15000 })
  const live = useSelector((state) => (data?.brigade ? selectBrigadeById(state, data.brigade.id) : null))
  const [updateStatus, { isLoading: updating, originalArgs }] = useUpdateBrigadeStatusMutation()

  if (isLoading) return <PageLoader />
  if (error || !data) {
    return <EmptyState icon="helicopter" title={t('myBrigade.noBrigade')} description={error ? errorText(error) : undefined} />
  }

  const brigade = live ?? data.brigade
  const status = BRIGADE_STATUS[brigade.status]
  const focus = brigade.target ?? { lat: brigade.lat, lng: brigade.lng }

  const change = (next) =>
    run(updateStatus({ id: brigade.id, status: next }), 'toast.brigadeStatus', {
      name: brigade.name,
      status: t(`brigadeStatus.${next}`),
    })

  return (
    <div className="p-4 space-y-4">
      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_460px] gap-4 items-start">
        <div className="space-y-4 min-w-0">
          <Card>
            <div className="flex flex-wrap items-center gap-4">
              <Icon3D name={BRIGADE_TYPES[brigade.type]?.icon} size={56} />
              <div className="min-w-0 flex-1">
                <p className="text-lg font-bold">{brigade.name}</p>
                <p className="text-sm text-muted">
                  <span className="font-mono">{brigade.code}</span> · {t(`brigadeType.${brigade.type}`)} ·{' '}
                  {t('map.members', { count: brigade.members })}
                </p>
              </div>
              <div className="text-right">
                <p className="text-[11px] uppercase tracking-wide text-muted">{t('myBrigade.status')}</p>
                <StatusBadge meta={status} label={t(`brigadeStatus.${brigade.status}`)} />
                <p className="text-[11px] text-subtle mt-1">{formatAgo(brigade.statusChangedAt, now)}</p>
              </div>
            </div>
            {brigade.target && (
              <p className="text-xs text-muted mt-3">
                {t('myBrigade.target', { lat: brigade.target.lat.toFixed(5), lng: brigade.target.lng.toFixed(5) })}
              </p>
            )}
            <div className="mt-4 pt-4 border-t border-border">
              <p className="text-xs font-semibold text-muted mb-2">{t('myBrigade.changeStatus')}</p>
              <div className="flex flex-wrap gap-2">
                {BRIGADE_TRANSITIONS[brigade.status].length === 0 ? (
                  <span className="text-xs text-subtle">{t('brigadesPage.viaDecision')}</span>
                ) : (
                  BRIGADE_TRANSITIONS[brigade.status].map((next) => {
                    const meta = BRIGADE_STATUS[next]
                    return (
                      <Button
                        key={next}
                        variant="secondary"
                        loading={updating && originalArgs?.status === next}
                        onClick={() => change(next)}
                        leftIcon={meta?.Icon ? <meta.Icon className="w-4 h-4" /> : null}
                      >
                        {t(`brigadeStatus.${next}`)}
                      </Button>
                    )
                  })
                )}
              </div>
            </div>
          </Card>

          <Card padding="none" className="overflow-hidden h-[52vh] min-h-[380px]">
            <OperationsMap layers={{ zones: false, heatmap: false }} focus={focus} />
          </Card>
        </div>

        <aside className="space-y-4 min-w-0">
          <h2 className="text-sm font-semibold flex items-center gap-2">
            <Icon3D name="sos" size={24} /> {t('myBrigade.tasks')}
          </h2>
          {data.sos.length === 0 && !data.alert ? (
            <Card>
              <EmptyState icon="safe" title={t('myBrigade.noTasks')} />
            </Card>
          ) : (
            data.sos.map((s) => <TriageItem key={s.id} sos={s} />)
          )}
          {data.alert && (
            <>
              <p className="text-[11px] uppercase tracking-wide text-muted font-semibold">{t('myBrigade.alert')}</p>
              <AlertCard alert={data.alert} />
            </>
          )}
        </aside>
      </div>
    </div>
  )
}
