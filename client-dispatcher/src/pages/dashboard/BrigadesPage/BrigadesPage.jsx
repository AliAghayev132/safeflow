// Redux
import { useSelector } from 'react-redux'
import { selectBrigades, selectAlerts, selectSos, selectZoneById } from '@store/slices/liveSlice'
import { useUpdateBrigadeStatusMutation } from '@store/api'
import { useAction } from '@store/hooks'

// i18n
import { useTranslation } from 'react-i18next'

// Components
import { Table, Icon3D, Button, StatCard, StatusBadge } from '@components'

// Constants / utils
import { BRIGADE_TYPES, BRIGADE_STATUS, BRIGADE_TRANSITIONS } from '@constants'
import { formatAgo, alertText } from '@utils'
import { useNow, useCan } from '@hooks'

export const BrigadesPage = () => {
  const { t } = useTranslation()
  const brigades = useSelector(selectBrigades)
  const alerts = useSelector(selectAlerts)
  const sos = useSelector(selectSos)
  const zones = useSelector(selectZoneById)
  const operator = useSelector((state) => state.auth.operator)
  const check = useCan()
  const now = useNow(15000)
  const run = useAction()
  const [updateStatus, { isLoading, originalArgs }] = useUpdateBrigadeStatusMutation()

  const alertById = Object.fromEntries(alerts.map((a) => [a.id, a]))
  const sosByBrigade = Object.fromEntries(
    sos.filter((s) => s.brigade && s.status === 'assigned').map((s) => [s.brigade, s])
  )
  const count = (status) => brigades.filter((b) => b.status === status).length
  const canChange = (b) => check('brigade:update') || (check('brigade:update_own') && operator?.brigade === b.id)

  const change = (b, status) =>
    run(updateStatus({ id: b.id, status }), 'toast.brigadeStatus', {
      name: b.name,
      status: t(`brigadeStatus.${status}`),
    })

  const task = (b) => {
    if (b.alert && alertById[b.alert]) return `${t('brigadesPage.alertTask')}: ${alertText(alertById[b.alert], zones).title}`
    const s = sosByBrigade[b.id]
    if (s) return `${t('brigadesPage.sosTask')}: ${t(`sosType.${s.type}`)} · ${zones[s.zone]?.name ?? ''}`
    return t('app.none')
  }

  return (
    <div className="p-5 space-y-4">
      <div className="grid gap-3 grid-cols-[repeat(auto-fit,minmax(200px,1fr))]">
        <StatCard icon="safe" title={t('brigadeStatus.available')} value={count('available')} tone={count('available') ? 'success' : 'critical'} />
        <StatCard icon="fireEngine" title={t('brigadeStatus.dispatched')} value={count('dispatched')} />
        <StatCard icon="siren" title={t('brigadeStatus.on_scene')} value={count('on_scene')} />
        <StatCard icon="compass" title={t('brigadeStatus.returning')} value={count('returning')} />
      </div>

      <Table>
        <Table.Head>
          <tr>
            {['brigade', 'type', 'crew', 'status', 'task', 'change'].map((c) => (
              <Table.Th key={c} className={c === 'change' ? 'text-right' : undefined}>
                {t(`brigadesPage.columns.${c}`)}
              </Table.Th>
            ))}
          </tr>
        </Table.Head>
        <tbody>
          {brigades.map((b) => (
            <Table.Row key={b.id}>
              <Table.Td>
                <div className="flex items-center gap-3">
                  <Icon3D name={BRIGADE_TYPES[b.type]?.icon} size={32} />
                  <div>
                    <p className="font-medium">{b.name}</p>
                    <p className="text-xs text-muted font-mono">{b.code}</p>
                  </div>
                </div>
              </Table.Td>
              <Table.Td className="text-muted">{t(`brigadeType.${b.type}`)}</Table.Td>
              <Table.Td className="tabular-nums">{t('map.members', { count: b.members })}</Table.Td>
              <Table.Td>
                <StatusBadge meta={BRIGADE_STATUS[b.status]} label={t(`brigadeStatus.${b.status}`)} />
                <p className="text-[11px] text-subtle mt-1">{formatAgo(b.statusChangedAt, now)}</p>
              </Table.Td>
              <Table.Td className="text-muted max-w-xs">
                <p className="truncate">{task(b)}</p>
              </Table.Td>
              <Table.Td>
                <div className="flex justify-end gap-2">
                  {!canChange(b) ? null : BRIGADE_TRANSITIONS[b.status].length === 0 ? (
                    <span className="text-xs text-subtle">{t('brigadesPage.viaDecision')}</span>
                  ) : (
                    BRIGADE_TRANSITIONS[b.status].map((next) => (
                      <Button
                        key={next}
                        size="sm"
                        variant="secondary"
                        loading={isLoading && originalArgs?.id === b.id && originalArgs?.status === next}
                        onClick={() => change(b, next)}
                      >
                        {t(`brigadeStatus.${next}`)}
                      </Button>
                    ))
                  )}
                </div>
              </Table.Td>
            </Table.Row>
          ))}
        </tbody>
      </Table>
    </div>
  )
}
