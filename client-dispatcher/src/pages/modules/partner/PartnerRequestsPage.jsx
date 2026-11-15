import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Save, MapPin } from 'lucide-react'

import { Card, Table, Button, Icon3D, EmptyState, PageLoader, StatusBadge, Badge, Select } from '@components'
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
            <Select
              size="sm"
              className="w-44"
              aria-label={t('partnerRequests.status')}
              value={status}
              onValueChange={setStatus}
              options={REQUEST_STATUSES.map((s) => ({ value: s, label: t(`partnerRequests.statuses.${s}`) }))}
            />
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
            <Select
              size="sm"
              className="w-48"
              aria-label={t('partnerRequests.filter')}
              value={filter}
              onValueChange={setFilter}
              options={[
                { value: '', label: t('partnerRequests.all') },
                ...REQUEST_STATUSES.map((s) => ({ value: s, label: t(`partnerRequests.statuses.${s}`) })),
              ]}
            />
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
