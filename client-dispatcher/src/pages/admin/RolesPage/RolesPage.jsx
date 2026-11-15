// React
import { Fragment, useState } from 'react'
import { clsx } from 'clsx'

// Redux
import { useSelector } from 'react-redux'
import { useGetRolesQuery, useGetOperatorsQuery } from '@store/api'
import { selectRole } from '@store/slices/authSlice'

// i18n
import { useTranslation } from 'react-i18next'

// Icons
import { CircleCheck, Minus, Search } from 'lucide-react'

// Components
import { Card, Table, Icon3D, PageLoader, EmptyState, Badge, StatusBadge } from '@components'

// Hooks / utils
import { useCan } from '@hooks'
import { hasPermission, formatDateTime } from '@utils'

// Role → solid accent for its summary card (colour + text, never colour alone)
const ROLE_ACCENT = {
  citizen: 'bg-panel-3',
  volunteer: 'bg-success',
  shelter_manager: 'bg-warning',
  brigade_lead: 'bg-orange',
  dispatcher: 'bg-info',
  admin: 'bg-critical',
}

/**
 * Roles & permissions straight from config/rbac.json (inheritance already
 * resolved by the server): role summary cards + a matrix grouped by area
 * with readable permission names, search and an "only differing" filter.
 */
export const RolesPage = () => {
  const { t, i18n } = useTranslation()
  const myRole = useSelector(selectRole)
  const canOperators = useCan('operator:read')
  const { data: roles, isLoading } = useGetRolesQuery()
  const { data: operators = [] } = useGetOperatorsQuery(undefined, { skip: !canOperators })
  const [query, setQuery] = useState('')
  const [onlyDiff, setOnlyDiff] = useState(false)

  if (isLoading) return <PageLoader />
  if (!roles) return <EmptyState icon="lock" title={t('app.loadFailed')} />

  const roleNames = Object.keys(roles)
  const permKey = (p) => `perm.names.${p.replace(":", "_")}`
  const permName = (p) => (i18n.exists(permKey(p)) ? t(permKey(p)) : p)
  const q = query.trim().toLowerCase()
  const all = [...new Set(roleNames.flatMap((r) => roles[r].permissions))]
    .filter((p) => !q || `${p} ${permName(p)}`.toLowerCase().includes(q))
    .filter((p) => {
      if (!onlyDiff) return true
      const n = roleNames.filter((r) => hasPermission(roles[r].permissions, p)).length
      return n > 0 && n < roleNames.length
    })
  const grouped = {}
  for (const p of all) (grouped[p.split(':')[0]] ??= []).push(p)
  const domains = Object.entries(grouped).sort(([a], [b]) => a.localeCompare(b))

  return (
    <div className="p-5 space-y-4">
      <Card className="flex flex-wrap items-center gap-3">
        <Icon3D name="lock" size={36} />
        <div className="flex-1 min-w-60">
          <h2 className="font-semibold">{t('roles.title')}</h2>
          <p className="text-xs text-muted">{t('roles.subtitle')}</p>
        </div>
      </Card>

      {/* Role summary */}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
        {roleNames.map((r) => (
          <Card key={r} className={clsx('relative overflow-hidden pl-5', r === myRole && 'border-info')}>
            <span className={clsx('absolute inset-y-0 left-0 w-1.5', ROLE_ACCENT[r] ?? 'bg-panel-3')} aria-hidden />
            <p className="text-sm font-bold text-text">
              {t(`role.${r}`, { defaultValue: r })}
              {r === myRole && <span className="ml-1.5 text-xs font-semibold text-info">({t('roles.you')})</span>}
            </p>
            <p className="mt-1 text-2xl font-extrabold tabular-nums text-text">{roles[r].permissions.length}</p>
            <p className="text-xs text-muted">{t('roles.permCount')}</p>
          </Card>
        ))}
      </div>

      {/* Matrix */}
      <Card padding="none">
        <div className="flex flex-wrap items-center gap-3 border-b border-border p-4">
          <h3 className="mr-auto text-sm font-bold text-text">{t('roles.matrix')}</h3>
          <label className="flex items-center gap-2 text-xs font-medium text-muted cursor-pointer">
            <input
              type="checkbox"
              className="h-4 w-4 accent-info"
              checked={onlyDiff}
              onChange={(e) => setOnlyDiff(e.target.checked)}
            />
            {t('roles.onlyDiff')}
          </label>
          <label className="flex h-9 w-full items-center gap-2 rounded-lg border border-border bg-panel-2 px-3 focus-within:border-info sm:w-64">
            <Search className="h-4 w-4 text-muted" aria-hidden />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t('roles.search')}
              aria-label={t('roles.search')}
              className="h-full w-full bg-transparent text-sm text-text placeholder:text-subtle focus:outline-none"
            />
          </label>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-panel">
              <tr className="border-b border-border">
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted">
                  {t('roles.permission')}
                </th>
                {roleNames.map((r) => (
                  <th key={r} className="px-3 py-3 text-center text-xs font-semibold text-muted whitespace-nowrap">
                    {t(`role.${r}`, { defaultValue: r })}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {domains.map(([domain, perms]) => (
                <Fragment key={domain}>
                  <tr className="bg-panel-2/70">
                    <th
                      colSpan={roleNames.length + 1}
                      scope="colgroup"
                      className="px-4 py-2 text-left text-xs font-bold uppercase tracking-wide text-text"
                    >
                      {t(`perm.domains.${domain}`, { defaultValue: domain })}
                    </th>
                  </tr>
                  {perms.map((p) => (
                    <tr key={p} className="border-b border-border/60 hover:bg-panel-2/40">
                      <th scope="row" className="px-4 py-2.5 text-left font-normal">
                        <span className="block text-sm text-text">{permName(p)}</span>
                        <span className="block font-mono text-[11px] text-subtle">{p}</span>
                      </th>
                      {roleNames.map((r) =>
                        hasPermission(roles[r].permissions, p) ? (
                          <td key={r} className="px-3 py-2.5 text-center">
                            <CircleCheck className="mx-auto h-5 w-5 text-success" aria-hidden />
                            <span className="sr-only">{t('roles.granted')}</span>
                          </td>
                        ) : (
                          <td key={r} className="px-3 py-2.5 text-center">
                            <span className="mx-auto block h-1.5 w-1.5 rounded-full bg-border-strong" aria-hidden />
                            <span className="sr-only">{t('roles.denied')}</span>
                          </td>
                        )
                      )}
                    </tr>
                  ))}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {canOperators && operators.length > 0 && (
        <Card padding="none">
          <div className="p-4 pb-2">
            <Card.Header title={t('roles.operators')} icon={<Icon3D name="people" size={28} />} className="mb-0" />
          </div>
          <Table className="border-0 rounded-none">
            <Table.Head>
              <tr>
                {['username', 'name', 'role', 'status', 'lastLogin'].map((c) => (
                  <Table.Th key={c}>{t(`roles.columns.${c}`)}</Table.Th>
                ))}
              </tr>
            </Table.Head>
            <tbody>
              {operators.map((o) => (
                <Table.Row key={o.id}>
                  <Table.Td className="font-mono text-xs">@{o.username}</Table.Td>
                  <Table.Td>{o.fullName}</Table.Td>
                  <Table.Td>
                    <Badge variant="neutral">{t(`role.${o.role}`, { defaultValue: o.role })}</Badge>
                  </Table.Td>
                  <Table.Td>
                    <StatusBadge
                      meta={o.isActive ? { variant: 'success', Icon: CircleCheck } : { variant: 'neutral', Icon: Minus }}
                      label={o.isActive ? t('roles.active') : t('roles.inactive')}
                    />
                  </Table.Td>
                  <Table.Td className="text-xs text-muted tabular-nums">{formatDateTime(o.lastLoginAt)}</Table.Td>
                </Table.Row>
              ))}
            </tbody>
          </Table>
        </Card>
      )}
    </div>
  )
}
