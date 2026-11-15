// React
import { Fragment, useState } from 'react'

// Redux
import { useSelector } from 'react-redux'
import {
  selectAlerts,
  selectZoneById,
  selectBrigadeEntities,
  selectShelterEntities,
} from '@store/slices/liveSlice'

// i18n
import { useTranslation } from 'react-i18next'

// Components
import { Table, Icon3D, EmptyState, AlertCard, StatusBadge } from '@components'

// Constants / utils
import { ALERT_TYPES, ALERT_STATUS, ALERT_STATUS_FILTERS } from '@constants'
import { formatDateTime, alertText } from '@utils'

export const AlertsPage = () => {
  const { t } = useTranslation()
  const alerts = useSelector(selectAlerts)
  const zones = useSelector(selectZoneById)
  const brigades = useSelector(selectBrigadeEntities)
  const shelters = useSelector(selectShelterEntities)
  const [filter, setFilter] = useState('all')
  const [expanded, setExpanded] = useState(null)

  const counts = alerts.reduce((acc, a) => ({ ...acc, [a.status]: (acc[a.status] ?? 0) + 1 }), {})
  const rows = filter === 'all' ? alerts : alerts.filter((a) => a.status === filter)

  const target = (alert) => {
    const action = alert.actions.find((a) => a.executed) ?? alert.actions[0]
    if (!action) return t('app.none')
    if (action.type === 'dispatch_brigade') return brigades[action.brigade]?.name ?? t('app.none')
    return shelters[action.shelter]?.name ?? t('app.none')
  }

  return (
    <div className="p-5 space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        {ALERT_STATUS_FILTERS.map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            aria-pressed={filter === f}
            className={`h-9 px-3 rounded-lg text-sm font-medium border cursor-pointer ${
              filter === f ? 'bg-panel-3 border-border-strong text-text' : 'bg-panel border-border text-muted hover:text-text'
            }`}
          >
            {t(`alertStatus.${f}`)}
            <span className="ml-2 text-xs text-subtle tabular-nums">
              {f === 'all' ? alerts.length : (counts[f] ?? 0)}
            </span>
          </button>
        ))}
        <p className="ml-auto text-xs text-muted">{t('alertsPage.hint')}</p>
      </div>

      {rows.length === 0 ? (
        <EmptyState icon="bell" title={t('alertsPage.empty')} />
      ) : (
        <Table>
          <Table.Head>
            <tr>
              {['type', 'alert', 'zone', 'signals', 'target', 'status', 'created'].map((c) => (
                <Table.Th key={c}>{t(`alertsPage.columns.${c}`)}</Table.Th>
              ))}
            </tr>
          </Table.Head>
          <tbody>
            {rows.map((a) => (
              <Fragment key={a.id}>
                <Table.Row
                  className={`cursor-pointer ${a.status === 'active' ? 'bg-critical-soft' : ''}`}
                  onClick={() => setExpanded(expanded === a.id ? null : a.id)}
                >
                  <Table.Td>
                    <span className="flex items-center gap-2 whitespace-nowrap">
                      <Icon3D name={ALERT_TYPES[a.type]?.icon} size={24} />
                      {t(`alertType.${a.type}`)}
                    </span>
                  </Table.Td>
                  <Table.Td className="max-w-md">
                    <p className="font-medium truncate">{alertText(a, zones).title}</p>
                  </Table.Td>
                  <Table.Td>{zones[a.zone]?.name ?? t('app.none')}</Table.Td>
                  <Table.Td className="tabular-nums">{a.type === 'sos_cluster' ? a.signalCount : t('app.none')}</Table.Td>
                  <Table.Td className="text-muted">{target(a)}</Table.Td>
                  <Table.Td>
                    <StatusBadge meta={ALERT_STATUS[a.status]} label={t(`alertStatus.${a.status}`)} />
                  </Table.Td>
                  <Table.Td className="text-muted whitespace-nowrap tabular-nums">{formatDateTime(a.createdAt)}</Table.Td>
                </Table.Row>
                {expanded === a.id && (
                  <tr className="border-t border-border">
                    <td colSpan={7} className="p-4 bg-bg">
                      <div className="max-w-2xl">
                        <AlertCard alert={a} />
                      </div>
                    </td>
                  </tr>
                )}
              </Fragment>
            ))}
          </tbody>
        </Table>
      )}
    </div>
  )
}
