// React
import { Fragment, useState } from 'react'

// Redux
import { useGetAuditQuery } from '@store/api'

// i18n
import { useTranslation } from 'react-i18next'

// Icons
import { ChevronDown, ChevronRight, Filter, X, RefreshCw } from 'lucide-react'

// Components
import { Card, Table, Button, Input, Icon3D, EmptyState, PageLoader, Badge } from '@components'

const EMPTY = { action: '', actor: '', from: '', to: '' }
const PAGE = 100
const MAX = 500

// <input type="datetime-local"> value → ISO string (UTC)
const toIso = (local) => (local ? new Date(local).toISOString() : undefined)

const roleVariant = { admin: 'critical', dispatcher: 'info', brigade_lead: 'warning', system: 'neutral' }

/**
 * Immutable operator audit log: who did what, to which object, when (ISO
 * timestamps), with the full details payload.
 */
export const AuditPage = () => {
  const { t } = useTranslation()
  const [form, setForm] = useState(EMPTY)
  const [applied, setApplied] = useState(EMPTY)
  const [limit, setLimit] = useState(PAGE)
  const [open, setOpen] = useState(null)

  const params = {
    limit,
    ...(applied.action && { action: applied.action.trim() }),
    ...(applied.actor && { actor: applied.actor.trim() }),
    ...(applied.from && { from: toIso(applied.from) }),
    ...(applied.to && { to: toIso(applied.to) }),
  }
  const { data: entries = [], isLoading, isFetching, refetch } = useGetAuditQuery(params, {
    refetchOnMountOrArgChange: true,
  })

  const onChange = (e) => setForm((f) => ({ ...f, [e.target.name]: e.target.value }))
  const apply = (e) => {
    e.preventDefault()
    setLimit(PAGE)
    setApplied(form)
  }
  const clear = () => {
    setForm(EMPTY)
    setApplied(EMPTY)
    setLimit(PAGE)
  }

  return (
    <div className="p-5 space-y-4">
      <Card>
        <div className="flex items-center gap-3 mb-4">
          <Icon3D name="pager" size={36} />
          <div className="flex-1">
            <h2 className="font-semibold">{t('audit.title')}</h2>
            <p className="text-xs text-muted">{t('audit.subtitle')}</p>
          </div>
          <Button variant="ghost" size="sm" loading={isFetching} onClick={refetch} leftIcon={<RefreshCw className="w-4 h-4" />}>
            {t('app.refresh')}
          </Button>
        </div>
        <form onSubmit={apply} className="grid grid-cols-1 md:grid-cols-[1fr_1fr_1fr_1fr_auto_auto] gap-3 items-end">
          <Input id="audit-action" name="action" label={t('audit.action')} value={form.action} onChange={onChange} placeholder="alert.approve" />
          <Input id="audit-actor" name="actor" label={t('audit.actor')} value={form.actor} onChange={onChange} placeholder="dispatcher" />
          <Input id="audit-from" name="from" type="datetime-local" label={t('audit.from')} value={form.from} onChange={onChange} />
          <Input id="audit-to" name="to" type="datetime-local" label={t('audit.to')} value={form.to} onChange={onChange} />
          <Button type="submit" leftIcon={<Filter className="w-4 h-4" />}>
            {t('audit.apply')}
          </Button>
          <Button variant="ghost" onClick={clear} leftIcon={<X className="w-4 h-4" />}>
            {t('audit.clear')}
          </Button>
        </form>
      </Card>

      {isLoading ? (
        <PageLoader />
      ) : entries.length === 0 ? (
        <EmptyState icon="pager" title={t('audit.empty')} />
      ) : (
        <>
          <Table>
            <Table.Head>
              <tr>
                <Table.Th className="w-8" />
                {['at', 'actor', 'action', 'target', 'ip'].map((c) => (
                  <Table.Th key={c}>{t(`audit.columns.${c}`)}</Table.Th>
                ))}
              </tr>
            </Table.Head>
            <tbody>
              {entries.map((e) => (
                <Fragment key={e.id}>
                  <Table.Row className="cursor-pointer" onClick={() => setOpen(open === e.id ? null : e.id)}>
                    <Table.Td className="text-muted">
                      {open === e.id ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                    </Table.Td>
                    <Table.Td className="font-mono text-xs whitespace-nowrap">{e.at}</Table.Td>
                    <Table.Td>
                      <span className="flex items-center gap-2 whitespace-nowrap">
                        <span className="font-medium">{e.actor.username}</span>
                        <Badge size="sm" variant={roleVariant[e.actor.role] ?? 'neutral'}>
                          {t(`role.${e.actor.role}`, { defaultValue: e.actor.role })}
                        </Badge>
                      </span>
                    </Table.Td>
                    <Table.Td className="font-mono text-xs">{e.action}</Table.Td>
                    <Table.Td className="text-xs max-w-sm">
                      <p className="truncate">
                        {e.target?.type && <span className="text-subtle">{e.target.type} · </span>}
                        {e.target?.label ?? e.target?.id ?? t('app.none')}
                      </p>
                    </Table.Td>
                    <Table.Td className="font-mono text-xs text-muted">{e.ip ?? t('app.none')}</Table.Td>
                  </Table.Row>
                  {open === e.id && (
                    <tr className="border-t border-border">
                      <td colSpan={6} className="p-4 bg-bg">
                        <p className="text-[11px] uppercase tracking-wide text-muted mb-1">{t('audit.columns.details')}</p>
                        <pre className="text-xs font-mono text-text whitespace-pre-wrap break-all bg-panel-2 border border-border rounded-lg p-3 max-h-80 overflow-auto">
                          {JSON.stringify({ target: e.target, details: e.details }, null, 2)}
                        </pre>
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </Table>
          {entries.length >= limit && limit < MAX && (
            <div className="flex justify-center">
              <Button variant="secondary" loading={isFetching} onClick={() => setLimit((l) => Math.min(MAX, l + PAGE))}>
                {t('app.loadMore')}
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
