import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Save, Plus, Trash2, Webhook } from 'lucide-react'

import { Button, Input, Table, StatusBadge, Badge } from '@components'
import { useAction } from '@store/hooks'
import {
  useUpdatePartnerMutation,
  useAddPartnerWebhookMutation,
  useRemovePartnerWebhookMutation,
  useGetPartnerDeliveriesQuery,
  useGetPartnerActivityQuery,
} from '@store/api/partnerApi'
import { formatDateTime } from '@utils'
import { DELIVERY_STATUS_META } from './partnerMeta'
import { SecretReveal } from './SecretReveal'

const EVENT_SCOPE = {
  'incident.created': 'incidents:read',
  'incident.updated': 'incidents:read',
  'assembly_point.updated': 'assembly_points:read',
  'road.updated': 'roads:read',
  'request.updated': 'requests:write',
}

/** Expanded row: scopes & limit, webhooks, delivery log, API activity. */
export const PartnerDetail = ({ client, meta }) => {
  const { t } = useTranslation()
  const run = useAction()
  const [update, { isLoading: saving }] = useUpdatePartnerMutation()
  const [addHook, { isLoading: adding }] = useAddPartnerWebhookMutation()
  const [removeHook] = useRemovePartnerWebhookMutation()
  const { data: deliveries = [] } = useGetPartnerDeliveriesQuery(client.id, { pollingInterval: 15000 })
  const { data: activity = [] } = useGetPartnerActivityQuery(client.id, { pollingInterval: 15000 })

  const [scopes, setScopes] = useState(client.scopes)
  const [rate, setRate] = useState(client.rateLimitPerMin)
  const [hookUrl, setHookUrl] = useState('')
  const allowedEvents = (meta?.events ?? []).filter((e) => client.scopes.includes(EVENT_SCOPE[e]))
  const [hookEvents, setHookEvents] = useState(allowedEvents)
  const [revealed, setRevealed] = useState(null)

  const toggle = (list, setList, value) =>
    setList(list.includes(value) ? list.filter((v) => v !== value) : [...list, value])

  const save = () =>
    run(update({ id: client.id, scopes, rateLimitPerMin: Number(rate) }), 'partners.toastUpdated', { name: client.name })

  const createHook = async (e) => {
    e.preventDefault()
    const data = await run(addHook({ id: client.id, url: hookUrl, events: hookEvents }), 'partners.toastWebhook')
    if (data?.webhook) {
      setRevealed(data.webhook)
      setHookUrl('')
    }
  }

  return (
    <div className="grid gap-4 p-4 xl:grid-cols-2">
      {/* Access */}
      <section className="space-y-3">
        <h4 className="text-xs font-semibold uppercase tracking-wide text-muted">{t('partners.access')}</h4>
        <div className="flex flex-wrap gap-2">
          {(meta?.scopes ?? []).map((s) => (
            <label key={s} className="flex min-h-9 cursor-pointer items-center gap-2 rounded-lg border border-border bg-panel px-2.5 text-xs">
              <input type="checkbox" checked={scopes.includes(s)} onChange={() => toggle(scopes, setScopes, s)} />
              <span className="font-mono">{s}</span>
            </label>
          ))}
        </div>
        <div className="flex items-end gap-2">
          <Input
            id={`rate-${client.id}`}
            type="number"
            min={1}
            label={t('partners.rateLimit')}
            value={rate}
            onChange={(e) => setRate(e.target.value)}
            className="w-48"
          />
          <Button onClick={save} loading={saving} disabled={!scopes.length} leftIcon={<Save className="w-4 h-4" />}>
            {t('app.save')}
          </Button>
        </div>
        {client.requireMtls && (
          <p className="text-xs text-muted">
            {t('partners.mtlsFingerprints')}:{' '}
            <span className="font-mono text-text">{client.certFingerprints.join(', ') || t('app.none')}</span>
          </p>
        )}
      </section>

      {/* Webhooks */}
      <section className="space-y-3">
        <h4 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted">
          <Webhook className="w-3.5 h-3.5" aria-hidden /> {t('partners.webhooks')}
        </h4>
        {revealed && (
          <SecretReveal
            title={t('partners.webhookCreated')}
            rows={[
              { label: 'URL', value: revealed.url },
              { label: t('partners.signingSecret'), value: revealed.secret },
            ]}
            onClose={() => setRevealed(null)}
          />
        )}
        {client.webhooks.length === 0 ? (
          <p className="text-xs text-muted">{t('partners.noWebhooks')}</p>
        ) : (
          <ul className="space-y-1.5">
            {client.webhooks.map((w) => (
              <li key={w.id} className="flex items-center gap-2 rounded-lg border border-border bg-panel px-3 py-2">
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-mono text-xs text-text">{w.url}</span>
                  <span className="block text-[11px] text-muted">{w.events.join(', ')}</span>
                </span>
                <Button
                  size="sm"
                  variant="ghost"
                  aria-label={t('partners.removeWebhook')}
                  onClick={() => run(removeHook({ id: client.id, webhookId: w.id }), 'partners.toastWebhookRemoved')}
                  leftIcon={<Trash2 className="w-3.5 h-3.5" />}
                />
              </li>
            ))}
          </ul>
        )}
        <form onSubmit={createHook} className="space-y-2 rounded-lg border border-border bg-panel-2 p-3">
          <Input
            id={`hook-${client.id}`}
            type="url"
            label={t('partners.webhookUrl')}
            placeholder="https://…"
            value={hookUrl}
            onChange={(e) => setHookUrl(e.target.value)}
            required
          />
          <div className="flex flex-wrap gap-2">
            {allowedEvents.map((ev) => (
              <label key={ev} className="flex items-center gap-1.5 text-xs">
                <input type="checkbox" checked={hookEvents.includes(ev)} onChange={() => toggle(hookEvents, setHookEvents, ev)} />
                <span className="font-mono">{ev}</span>
              </label>
            ))}
          </div>
          <Button type="submit" size="sm" loading={adding} disabled={!hookUrl || !hookEvents.length} leftIcon={<Plus className="w-3.5 h-3.5" />}>
            {t('partners.addWebhook')}
          </Button>
        </form>
      </section>

      {/* Deliveries */}
      <section className="space-y-2 xl:col-span-1">
        <h4 className="text-xs font-semibold uppercase tracking-wide text-muted">{t('partners.deliveries')}</h4>
        {deliveries.length === 0 ? (
          <p className="text-xs text-muted">{t('partners.noDeliveries')}</p>
        ) : (
          <Table>
            <Table.Head>
              <tr>
                <Table.Th>{t('partners.time')}</Table.Th>
                <Table.Th>{t('partners.event')}</Table.Th>
                <Table.Th>{t('partners.status')}</Table.Th>
                <Table.Th>{t('partners.attempts')}</Table.Th>
              </tr>
            </Table.Head>
            <tbody>
              {deliveries.map((d) => (
                <Table.Row key={d.id}>
                  <Table.Td className="whitespace-nowrap text-xs">{formatDateTime(d.createdAt)}</Table.Td>
                  <Table.Td className="font-mono text-xs">{d.event}</Table.Td>
                  <Table.Td>
                    <StatusBadge size="sm" meta={DELIVERY_STATUS_META[d.status]} label={t(`partners.delivery.${d.status}`)} />
                  </Table.Td>
                  <Table.Td className="text-xs tabular-nums">
                    {d.attempts}
                    {d.lastStatusCode ? ` · HTTP ${d.lastStatusCode}` : d.lastError ? ` · ${d.lastError}` : ''}
                  </Table.Td>
                </Table.Row>
              ))}
            </tbody>
          </Table>
        )}
      </section>

      {/* API activity (audit) */}
      <section className="space-y-2 xl:col-span-1">
        <h4 className="text-xs font-semibold uppercase tracking-wide text-muted">{t('partners.activity')}</h4>
        {activity.length === 0 ? (
          <p className="text-xs text-muted">{t('partners.noActivity')}</p>
        ) : (
          <Table>
            <Table.Head>
              <tr>
                <Table.Th>{t('partners.time')}</Table.Th>
                <Table.Th>{t('partners.action')}</Table.Th>
                <Table.Th>{t('partners.endpoint')}</Table.Th>
              </tr>
            </Table.Head>
            <tbody>
              {activity.map((e) => (
                <Table.Row key={e.id}>
                  <Table.Td className="whitespace-nowrap text-xs">{formatDateTime(e.at)}</Table.Td>
                  <Table.Td className="font-mono text-xs">{e.action}</Table.Td>
                  <Table.Td className="text-xs">
                    {e.details?.path ? (
                      <>
                        <span className="font-mono">{e.details.method} {e.details.path}</span>{' '}
                        <Badge size="sm" variant={e.details.status < 400 ? 'success' : 'critical'}>
                          {e.details.status}
                        </Badge>
                      </>
                    ) : (
                      e.details?.scopes?.join(' ') ?? e.details?.error ?? '—'
                    )}
                  </Table.Td>
                </Table.Row>
              ))}
            </tbody>
          </Table>
        )}
      </section>
    </div>
  )
}
