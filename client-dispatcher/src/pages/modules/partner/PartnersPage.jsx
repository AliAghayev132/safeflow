import { Fragment, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ChevronDown, ChevronRight, Plus, RotateCw, Trash2, Lock, FileJson } from 'lucide-react'

import { Card, Table, Button, Icon3D, EmptyState, PageLoader, StatusBadge, Badge } from '@components'
import { useAction } from '@store/hooks'
import { API_ORIGIN } from '@store/api'
import {
  useGetPartnerMetaQuery,
  useGetPartnersQuery,
  useSetPartnerStatusMutation,
  useRotatePartnerSecretMutation,
  useDeletePartnerMutation,
} from '@store/api/partnerApi'
import { formatAgo } from '@utils'
import { PARTNER_STATUS_META, PARTNER_TYPE_ICON } from './partnerMeta'
import { CreatePartnerForm } from './CreatePartnerForm'
import { PartnerDetail } from './PartnerDetail'
import { SecretReveal } from './SecretReveal'

const STATUS_ACTIONS = [
  { status: 'active', variant: 'success' },
  { status: 'limited', variant: 'warning' },
  { status: 'suspended', variant: 'critical' },
]

/**
 * Partner API administration: register agencies (OAuth2 clients), scopes,
 * one-click activate / limit / suspend, secret rotation, webhooks, delivery
 * log and audited API activity.
 */
export const PartnersPage = () => {
  const { t } = useTranslation()
  const run = useAction()
  const { data: meta } = useGetPartnerMetaQuery()
  const { data: clients = [], isLoading } = useGetPartnersQuery(undefined, { pollingInterval: 30000 })
  const [setStatus] = useSetPartnerStatusMutation()
  const [rotate] = useRotatePartnerSecretMutation()
  const [remove] = useDeletePartnerMutation()

  const [creating, setCreating] = useState(false)
  const [revealed, setRevealed] = useState(null)
  const [open, setOpen] = useState(null)

  const reveal = (client, secret, titleKey) =>
    setRevealed({
      title: t(titleKey, { name: client.name }),
      rows: [
        { label: 'client_id', value: client.clientId },
        { label: 'client_secret', value: secret },
      ],
    })

  const rotateSecret = async (client) => {
    if (!window.confirm(t('partners.confirmRotate', { name: client.name }))) return
    const data = await run(rotate(client.id), 'partners.toastRotated', { name: client.name })
    if (data?.clientSecret) reveal(data.client, data.clientSecret, 'partners.secretRotated')
  }

  const deleteClient = (client) => {
    if (!window.confirm(t('partners.confirmDelete', { name: client.name }))) return
    run(remove(client.id), 'partners.toastDeleted', { name: client.name })
  }

  if (isLoading) return <PageLoader />

  return (
    <div className="space-y-4 p-4">
      <Card>
        <Card.Header
          title={t('partners.title')}
          subtitle={t('partners.subtitle')}
          icon={<Icon3D name="lock" size={30} />}
          actions={
            <>
              <a
                href={`${API_ORIGIN}/api/partner/v1/openapi.json`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-border px-3 text-xs text-muted hover:text-text"
              >
                <FileJson className="w-3.5 h-3.5" aria-hidden /> OpenAPI
              </a>
              {!creating && (
                <Button size="sm" onClick={() => setCreating(true)} leftIcon={<Plus className="w-3.5 h-3.5" />}>
                  {t('partners.new')}
                </Button>
              )}
            </>
          }
        />
        <p className="text-xs text-muted">{t('partners.minimisation')}</p>
      </Card>

      {revealed && <SecretReveal title={revealed.title} rows={revealed.rows} onClose={() => setRevealed(null)} />}

      {creating && (
        <CreatePartnerForm
          meta={meta}
          onCancel={() => setCreating(false)}
          onCreated={({ client, clientSecret }) => {
            setCreating(false)
            reveal(client, clientSecret, 'partners.created')
          }}
        />
      )}

      {clients.length === 0 ? (
        <Card>
          <EmptyState icon="lock" title={t('partners.empty')} description={t('partners.emptyHint')} />
        </Card>
      ) : (
        <Table>
          <Table.Head>
            <tr>
              <Table.Th className="w-8" />
              <Table.Th>{t('partners.name')}</Table.Th>
              <Table.Th>{t('partners.scopes')}</Table.Th>
              <Table.Th>{t('partners.status')}</Table.Th>
              <Table.Th>{t('partners.rateLimit')}</Table.Th>
              <Table.Th>{t('partners.lastSeen')}</Table.Th>
              <Table.Th>{t('partners.actions')}</Table.Th>
            </tr>
          </Table.Head>
          <tbody>
            {clients.map((c) => {
              const expanded = open === c.id
              return (
                <Fragment key={c.id}>
                  <Table.Row>
                    <Table.Td>
                      <button
                        type="button"
                        onClick={() => setOpen(expanded ? null : c.id)}
                        aria-expanded={expanded}
                        aria-label={t('partners.details')}
                        className="text-muted hover:text-text cursor-pointer"
                      >
                        {expanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                      </button>
                    </Table.Td>
                    <Table.Td>
                      <div className="flex items-center gap-2.5">
                        <Icon3D name={PARTNER_TYPE_ICON[c.type] ?? 'antenna'} size={26} />
                        <div className="min-w-0">
                          <p className="flex items-center gap-1.5 font-semibold text-text">
                            {c.name}
                            {c.requireMtls && (
                              <Badge size="sm" variant="info">
                                <Lock className="w-3 h-3" aria-hidden /> mTLS
                              </Badge>
                            )}
                          </p>
                          <p className="font-mono text-[11px] text-muted">
                            {t(`partners.types.${c.type}`)} · {c.clientId}
                          </p>
                        </div>
                      </div>
                    </Table.Td>
                    <Table.Td>
                      <div className="flex flex-wrap gap-1">
                        {c.scopes.map((s) => (
                          <Badge key={s} size="sm">
                            {s}
                          </Badge>
                        ))}
                      </div>
                    </Table.Td>
                    <Table.Td>
                      <StatusBadge meta={PARTNER_STATUS_META[c.status]} label={t(`partners.statuses.${c.status}`)} />
                    </Table.Td>
                    <Table.Td className="tabular-nums text-xs">{t('partners.perMin', { value: c.rateLimitPerMin })}</Table.Td>
                    <Table.Td className="text-xs text-muted">{c.lastSeenAt ? formatAgo(c.lastSeenAt) : t('partners.never')}</Table.Td>
                    <Table.Td>
                      <div className="flex flex-wrap items-center gap-1.5">
                        {STATUS_ACTIONS.filter((a) => a.status !== c.status).map((a) => (
                          <Button
                            key={a.status}
                            size="sm"
                            variant={a.variant}
                            onClick={() =>
                              run(setStatus({ id: c.id, status: a.status }), `partners.toastStatus.${a.status}`, { name: c.name })
                            }
                          >
                            {t(`partners.statusAction.${a.status}`)}
                          </Button>
                        ))}
                        <Button size="sm" variant="secondary" onClick={() => rotateSecret(c)} leftIcon={<RotateCw className="w-3.5 h-3.5" />}>
                          {t('partners.rotate')}
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          aria-label={t('partners.delete')}
                          onClick={() => deleteClient(c)}
                          leftIcon={<Trash2 className="w-3.5 h-3.5" />}
                        />
                      </div>
                    </Table.Td>
                  </Table.Row>
                  {expanded && (
                    <tr className="border-t border-border bg-panel-2/40">
                      <td colSpan={7}>
                        <PartnerDetail key={c.updatedAt} client={c} meta={meta} />
                      </td>
                    </tr>
                  )}
                </Fragment>
              )
            })}
          </tbody>
        </Table>
      )}
    </div>
  )
}
