import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Save, MapPin } from 'lucide-react'

import { Card, Table, Button, Icon3D, EmptyState, PageLoader, StatusBadge, Badge } from '@components'
import { useAction } from '@store/hooks'
import { useCan } from '@hooks'
import { useGetPartnerRequestsQuery, useUpdatePartnerRequestMutation } from '@store/api/partnerApi'
import { formatDateTime } from '@utils'
import { REQUEST_STATUS_META, REQUEST_STATUSES } from './partnerMeta'

const RequestRow = ({ r, canDecide }) => {
  const { t } = useTranslation()
  const run = useAction()
  const [update, { isLoading }] = useUpdatePartnerRequestMutation()
  const [status, setStatus] = useState(r.status)
  const [response, setResponse] = useState(r.response ?? '')
  const dirty = status !== r.status || response !== (r.response ?? '')

  return (
    <Table.Row>
      <Table.Td className="whitespace-nowrap text-xs">{formatDateTime(r.createdAt)}</Table.Td>
      <Table.Td className="font-semibold text-text">{r.partner}</Table.Td>
      <Table.Td>
        <p className="font-semibold text-text">
          {r.title}{' '}
          {r.priority === 'urgent' && (
            <Badge size="sm" variant="solidCritical">
              {t('partnerRequests.urgent')}
            </Badge>
          )}
        </p>
        <p className="text-xs text-muted">
          {t(`partnerRequests.types.${r.type}`)}
          {r.quantity != null && ` · ${r.quantity}${r.unit ? ` ${r.unit}` : ''}`}
          {r.location && (
            <>
              {' · '}
              <MapPin className="inline w-3 h-3" aria-hidden /> {r.location.lat.toFixed(4)}, {r.location.lng.toFixed(4)}
            </>
          )}
        </p>
        {r.description && <p className="mt-1 max-w-md text-xs text-text">{r.description}</p>}
      </Table.Td>
      <Table.Td>
        <StatusBadge meta={REQUEST_STATUS_META[r.status]} label={t(`partnerRequests.statuses.${r.status}`)} />
      </Table.Td>
      <Table.Td>
        {canDecide ? (
          <div className="flex flex-wrap items-center gap-2">
            <label className="sr-only" htmlFor={`st-${r.id}`}>
              {t('partnerRequests.status')}
            </label>
            <select
              id={`st-${r.id}`}
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="h-9 rounded-lg border border-border bg-panel-2 px-2 text-xs text-text"
            >
              {REQUEST_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {t(`partnerRequests.statuses.${s}`)}
                </option>
              ))}
            </select>
            <label className="sr-only" htmlFor={`rs-${r.id}`}>
              {t('partnerRequests.response')}
            </label>
            <input
              id={`rs-${r.id}`}
              value={response}
              onChange={(e) => setResponse(e.target.value)}
              placeholder={t('partnerRequests.responsePlaceholder')}
              maxLength={1000}
              className="h-9 w-56 rounded-lg border border-border bg-panel-2 px-2 text-xs text-text"
            />
            <Button
              size="sm"
              loading={isLoading}
              disabled={!dirty}
              onClick={() => run(update({ id: r.id, status, response }), 'partnerRequests.toastUpdated')}
              leftIcon={<Save className="w-3.5 h-3.5" />}
            >
              {t('app.save')}
            </Button>
          </div>
        ) : (
          <span className="text-xs text-muted">{r.response ?? '—'}</span>
        )}
      </Table.Td>
    </Table.Row>
  )
}

/** Requests submitted by partner agencies through the Partner API. */
export const PartnerRequestsPage = () => {
  const { t } = useTranslation()
  const canDecide = useCan(['alert:decide', 'partners:manage'])
  const [filter, setFilter] = useState('')
  const { data: requests = [], isLoading } = useGetPartnerRequestsQuery(filter || undefined, { pollingInterval: 15000 })

  return (
    <div className="space-y-4 p-4">
      <Card>
        <Card.Header
          title={t('partnerRequests.title')}
          subtitle={t('partnerRequests.subtitle')}
          icon={<Icon3D name="megaphone" size={30} />}
          actions={
            <select
              aria-label={t('partnerRequests.filter')}
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="h-8 rounded-lg border border-border bg-panel-2 px-2 text-xs text-text"
            >
              <option value="">{t('partnerRequests.all')}</option>
              {REQUEST_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {t(`partnerRequests.statuses.${s}`)}
                </option>
              ))}
            </select>
          }
        />
      </Card>

      {isLoading ? (
        <PageLoader />
      ) : requests.length === 0 ? (
        <Card>
          <EmptyState icon="megaphone" title={t('partnerRequests.empty')} />
        </Card>
      ) : (
        <Table>
          <Table.Head>
            <tr>
              <Table.Th>{t('partners.time')}</Table.Th>
              <Table.Th>{t('partnerRequests.partner')}</Table.Th>
              <Table.Th>{t('partnerRequests.request')}</Table.Th>
              <Table.Th>{t('partnerRequests.status')}</Table.Th>
              <Table.Th>{t('partnerRequests.handle')}</Table.Th>
            </tr>
          </Table.Head>
          <tbody>
            {requests.map((r) => (
              <RequestRow key={`${r.id}:${r.updatedAt}`} r={r} canDecide={canDecide} />
            ))}
          </tbody>
        </Table>
      )}
    </div>
  )
}
