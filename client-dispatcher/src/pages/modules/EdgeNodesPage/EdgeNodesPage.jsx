// React
import { useState } from 'react'

// Redux
import { useSelector } from 'react-redux'
import { selectShelters } from '@store/slices/liveSlice'
import {
  useGetEdgeNodesQuery,
  useCreateEdgeNodeMutation,
  useRotateEdgeNodeMutation,
  useRevokeEdgeNodeMutation,
} from '@store/api/modules/edgeApi'
import { useAction } from '@store/hooks'

// i18n
import { useTranslation } from 'react-i18next'

// Icons
import { CircleCheck, CircleAlert, WifiOff, Ban, Clock, Copy, KeyRound } from 'lucide-react'

// Components
import { Card, Icon3D, PageLoader, EmptyState, StatusBadge, StatCard, Table, Button, Input, Select, useConfirm } from '@components'

// Hooks / utils
import { useCan } from '@hooks'
import { formatDateTime } from '@utils'

// Health → colour + icon + text (never colour alone)
const HEALTH = {
  online: { variant: 'success', Icon: CircleCheck },
  degraded: { variant: 'warning', Icon: CircleAlert },
  offline: { variant: 'critical', Icon: WifiOff },
  never: { variant: 'neutral', Icon: Clock },
  revoked: { variant: 'neutral', Icon: Ban },
}

/** One-time token reveal after create / rotate. */
const TokenReveal = ({ result, onClose }) => {
  const { t } = useTranslation()
  const [copied, setCopied] = useState(false)
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(result.token)
      setCopied(true)
    } catch {
      setCopied(false)
    }
  }
  return (
    <Card className="border-warning" role="alert">
      <Card.Header
        title={t('edge.tokenTitle', { node: result.node.nodeId })}
        subtitle={t('edge.tokenOnce')}
        icon={<KeyRound className="w-5 h-5 text-warning" aria-hidden />}
        actions={
          <Button variant="ghost" size="sm" onClick={onClose}>
            {t('app.close')}
          </Button>
        }
      />
      <div className="flex flex-wrap items-center gap-2">
        <code className="flex-1 min-w-0 break-all rounded-lg bg-panel-2 border border-border px-3 py-2 text-xs text-text">
          {result.token}
        </code>
        <Button variant="secondary" size="sm" leftIcon={<Copy className="w-4 h-4" />} onClick={copy}>
          {copied ? t('edge.copied') : t('edge.copy')}
        </Button>
      </div>
      <p className="mt-2 text-xs text-muted">{t('edge.tokenHint')}</p>
    </Card>
  )
}

/**
 * Edge nodes at assembly points: health (online / degraded / offline /
 * never / revoked), shelter, last sync / snapshot, items still queued on the
 * node, last error; create a node (one-time token), rotate or revoke it.
 * Polled every 10 s.
 */
export const EdgeNodesPage = () => {
  const { t } = useTranslation()
  const confirm = useConfirm()
  const canManage = useCan('edge:manage')
  const run = useAction()
  const shelters = useSelector(selectShelters)
  const { data: nodes = [], isLoading, isError } = useGetEdgeNodesQuery(undefined, { pollingInterval: 10000 })
  const [createNode, { isLoading: creating }] = useCreateEdgeNodeMutation()
  const [rotateNode] = useRotateEdgeNodeMutation()
  const [revokeNode] = useRevokeEdgeNodeMutation()
  const [form, setForm] = useState({ nodeId: '', name: '', shelterCode: '' })
  const [reveal, setReveal] = useState(null)

  if (isLoading) return <PageLoader />
  if (isError) return <EmptyState icon="antenna" title={t('app.loadFailed')} />

  const counts = nodes.reduce(
    (acc, n) => ({ ...acc, [n.health]: (acc[n.health] ?? 0) + 1, queued: acc.queued + (n.queued ?? 0) }),
    { queued: 0 }
  )
  const shelterName = (code) => shelters.find((s) => s.code === code)?.name ?? code ?? t('app.none')

  const submit = async (e) => {
    e.preventDefault()
    const data = await run(createNode(form), 'edge.created')
    if (data) {
      setReveal(data)
      setForm({ nodeId: '', name: '', shelterCode: '' })
    }
  }
  const rotate = async (node) => {
    if (!(await confirm({ message: t('edge.confirmRotate', { node: node.nodeId }), tone: 'warning' }))) return
    const data = await run(rotateNode(node.id), 'edge.rotated')
    if (data) setReveal(data)
  }
  const revoke = async (node) => {
    if (!(await confirm({ message: t('edge.confirmRevoke', { node: node.nodeId }), tone: 'critical' }))) return
    await run(revokeNode(node.id), 'edge.revoked')
  }

  return (
    <div className="p-4 space-y-4">
      <div className="grid gap-3 grid-cols-[repeat(auto-fit,minmax(180px,1fr))]">
        <StatCard icon="antenna" title={t('edge.health.online')} value={counts.online ?? 0} />
        <StatCard
          icon="warning"
          title={t('edge.health.offline')}
          value={(counts.offline ?? 0) + (counts.degraded ?? 0)}
          tone={counts.offline || counts.degraded ? 'warning' : 'neutral'}
        />
        <StatCard icon="hourglass" title={t('edge.queuedTotal')} value={counts.queued} tone={counts.queued ? 'warning' : 'neutral'} />
        <StatCard icon="shelter" title={t('edge.total')} value={nodes.length} />
      </div>

      {reveal && <TokenReveal result={reveal} onClose={() => setReveal(null)} />}

      {canManage && (
        <Card>
          <Card.Header title={t('edge.createTitle')} subtitle={t('edge.createHint')} icon={<Icon3D name="antenna" size={26} />} />
          <form onSubmit={submit} className="grid gap-3 md:grid-cols-[1fr_1.5fr_1.5fr_auto] items-end">
            <Input
              id="edge-node-id"
              label={t('edge.nodeId')}
              value={form.nodeId}
              placeholder="edge-sh06"
              required
              pattern="[A-Za-z0-9][A-Za-z0-9_-]{2,48}"
              onChange={(e) => setForm({ ...form, nodeId: e.target.value })}
            />
            <Input
              id="edge-node-name"
              label={t('edge.name')}
              value={form.name}
              required
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
            <Select
              id="edge-node-shelter"
              label={t('edge.shelter')}
              value={form.shelterCode}
              onChange={(e) => setForm({ ...form, shelterCode: e.target.value })}
              options={[
                { value: '', label: t('edge.noShelter') },
                ...shelters.map((s) => ({ value: s.code, label: `${s.code} · ${s.name}` })),
              ]}
            />
            <Button type="submit" loading={creating}>
              {t('edge.create')}
            </Button>
          </form>
        </Card>
      )}

      <Card padding="none">
        <div className="p-4 pb-2">
          <Card.Header title={t('edge.listTitle')} subtitle={t('edge.listHint')} icon={<Icon3D name="antenna" size={26} />} />
        </div>
        {nodes.length === 0 ? (
          <EmptyState icon="antenna" title={t('edge.empty')} description={t('edge.emptyHint')} />
        ) : (
          <Table className="rounded-none border-0">
            <Table.Head>
              <tr>
                <Table.Th>{t('edge.node')}</Table.Th>
                <Table.Th>{t('edge.shelter')}</Table.Th>
                <Table.Th>{t('edge.status')}</Table.Th>
                <Table.Th>{t('edge.lastSync')}</Table.Th>
                <Table.Th>{t('edge.queued')}</Table.Th>
                <Table.Th>{t('edge.received')}</Table.Th>
                <Table.Th>{t('edge.lastError')}</Table.Th>
                {canManage && <Table.Th className="text-right">{t('edge.actions')}</Table.Th>}
              </tr>
            </Table.Head>
            <tbody>
              {nodes.map((n) => (
                <Table.Row key={n.id}>
                  <Table.Td>
                    <p className="font-medium text-text">{n.name}</p>
                    <p className="text-xs text-muted font-mono">
                      {n.nodeId} · {n.tokenPrefix}…
                    </p>
                  </Table.Td>
                  <Table.Td className="text-xs">{shelterName(n.shelterCode)}</Table.Td>
                  <Table.Td>
                    <StatusBadge meta={HEALTH[n.health]} label={t(`edge.health.${n.health}`)} />
                  </Table.Td>
                  <Table.Td className="text-xs whitespace-nowrap">
                    <p>{n.lastSyncAt ? formatDateTime(n.lastSyncAt) : t('app.none')}</p>
                    <p className="text-muted">
                      {t('edge.lastSeen')}: {n.lastSeenAt ? formatDateTime(n.lastSeenAt) : t('app.none')}
                    </p>
                  </Table.Td>
                  <Table.Td className="tabular-nums">{n.queued ?? 0}</Table.Td>
                  <Table.Td className="text-xs tabular-nums">
                    {t('edge.receivedStats', {
                      sos: n.stats?.sos ?? 0,
                      duplicates: n.stats?.sosDuplicates ?? 0,
                      statuses: n.stats?.statuses ?? 0,
                    })}
                  </Table.Td>
                  <Table.Td className="text-xs max-w-64">
                    {n.lastError ? <span className="text-warning">{n.lastError}</span> : <span className="text-muted">{t('app.none')}</span>}
                  </Table.Td>
                  {canManage && (
                    <Table.Td className="text-right whitespace-nowrap">
                      <div className="inline-flex gap-2">
                        <Button size="sm" variant="secondary" onClick={() => rotate(n)}>
                          {t('edge.rotate')}
                        </Button>
                        {n.status !== 'revoked' && (
                          <Button size="sm" variant="critical" onClick={() => revoke(n)}>
                            {t('edge.revoke')}
                          </Button>
                        )}
                      </div>
                    </Table.Td>
                  )}
                </Table.Row>
              ))}
            </tbody>
          </Table>
        )}
      </Card>
    </div>
  )
}
