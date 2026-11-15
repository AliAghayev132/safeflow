// Redux
import { useSelector } from 'react-redux'
import { useGetRolesQuery, useGetOperatorsQuery } from '@store/api'
import { selectRole } from '@store/slices/authSlice'

// i18n
import { useTranslation } from 'react-i18next'

// Icons
import { CircleCheck, Minus } from 'lucide-react'

// Components
import { Card, Table, Icon3D, PageLoader, EmptyState, Badge, StatusBadge } from '@components'

// Hooks / utils
import { useCan } from '@hooks'
import { hasPermission, formatDateTime } from '@utils'

/**
 * Roles & permissions matrix straight from config/rbac.json (inheritance
 * already resolved by the server) + the staff list.
 */
export const RolesPage = () => {
  const { t } = useTranslation()
  const myRole = useSelector(selectRole)
  const canOperators = useCan('operator:read')
  const { data: roles, isLoading } = useGetRolesQuery()
  const { data: operators = [] } = useGetOperatorsQuery(undefined, { skip: !canOperators })

  if (isLoading) return <PageLoader />
  if (!roles) return <EmptyState icon="lock" title={t('app.loadFailed')} />

  const roleNames = Object.keys(roles)
  const permissions = [...new Set(roleNames.flatMap((r) => roles[r].permissions))].sort()

  return (
    <div className="p-5 space-y-4">
      <Card className="flex items-center gap-3">
        <Icon3D name="lock" size={36} />
        <div>
          <h2 className="font-semibold">{t('roles.title')}</h2>
          <p className="text-xs text-muted">{t('roles.subtitle')}</p>
        </div>
      </Card>

      <Table>
        <Table.Head>
          <tr>
            <Table.Th>{t('roles.permission')}</Table.Th>
            {roleNames.map((r) => (
              <Table.Th key={r} className="text-center">
                {t(`role.${r}`, { defaultValue: r })}
                {r === myRole && <span className="ml-1 normal-case text-info">({t('roles.you')})</span>}
              </Table.Th>
            ))}
          </tr>
        </Table.Head>
        <tbody>
          {permissions.map((p) => (
            <Table.Row key={p}>
              <Table.Td className="font-mono text-xs">{p}</Table.Td>
              {roleNames.map((r) => {
                const granted = hasPermission(roles[r].permissions, p)
                return (
                  <Table.Td key={r} className="text-center">
                    {granted ? (
                      <span className="inline-flex items-center gap-1 text-success text-xs font-semibold">
                        <CircleCheck className="w-4 h-4" aria-hidden /> {t('roles.granted')}
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-subtle text-xs">
                        <Minus className="w-4 h-4" aria-hidden /> {t('roles.denied')}
                      </span>
                    )}
                  </Table.Td>
                )
              })}
            </Table.Row>
          ))}
        </tbody>
      </Table>

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
