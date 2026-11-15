import { useEffect, useMemo, useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { useTranslation } from 'react-i18next'
import {
  BadgeCheck,
  BadgeAlert,
  Clock,
  CircleCheck,
  CircleX,
  Ban,
  Hourglass,
  HeartPulse,
  MapPin,
  FileText,
  Send,
} from 'lucide-react'

import { Card, Button, Select, Input, Table, EmptyState, StatusBadge, Icon3D, Badge } from '@components'
import {
  baseApi,
  useGetVolunteersQuery,
  useGetVolunteerRequestsQuery,
  useCreateVolunteerRequestMutation,
  useCancelVolunteerRequestMutation,
  useNotifyMedicalVolunteersMutation,
  useGetVerificationQueueQuery,
  useVerifyVolunteerMutation,
  openVolunteerDocument,
} from '@store/api'
import { useAction } from '@store/hooks'
import { useSocket } from '@store/context'
import { selectShelters } from '@store/slices/liveSlice'
import { useCan } from '@hooks'
import { formatAgo } from '@utils'
import { toast } from '@store/slices/uiSlice'

const PROFESSIONS = [
  'doctor',
  'nurse',
  'paramedic',
  'engineer',
  'electrician',
  'psychologist',
  'rescuer',
  'interpreter',
  'other',
]

// Every status = colour + icon + text
const AVAILABILITY = {
  ready: { variant: 'success', Icon: CircleCheck },
  not_ready: { variant: 'neutral', Icon: Clock },
}
const VERIFICATION = {
  not_required: { variant: 'neutral', Icon: BadgeCheck },
  unverified: { variant: 'warning', Icon: BadgeAlert },
  pending: { variant: 'info', Icon: Hourglass },
  verified: { variant: 'success', Icon: BadgeCheck },
  rejected: { variant: 'critical', Icon: CircleX },
}
const REQUEST_STATUS = {
  open: { variant: 'warning', Icon: Hourglass },
  filled: { variant: 'success', Icon: CircleCheck },
  cancelled: { variant: 'neutral', Icon: Ban },
  expired: { variant: 'neutral', Icon: Clock },
}

/** Live refresh: volunteer events from the socket (polling is the fallback). */
const useVolunteerLive = (onMedicalSuggestion) => {
  const { socket } = useSocket()
  const dispatch = useDispatch()
  useEffect(() => {
    if (!socket) return
    let timer = null
    const tags = new Set()
    const handler = (evt) => {
      if (!evt?.type?.startsWith('volunteer')) return
      if (evt.type === 'volunteer:medical_suggestion') onMedicalSuggestion?.(evt.data)
      tags.add(evt.type === 'volunteer:updated' ? 'Volunteers' : 'VolunteerRequests')
      if (evt.type === 'volunteer:updated') tags.add('VolunteerVerification')
      if (timer) return
      timer = setTimeout(() => {
        timer = null
        dispatch(baseApi.util.invalidateTags([...tags]))
        tags.clear()
      }, 800)
    }
    socket.on('evt', handler)
    return () => {
      socket.off('evt', handler)
      clearTimeout(timer)
    }
  }, [socket, dispatch, onMedicalSuggestion])
}

const RequestForm = () => {
  const { t } = useTranslation()
  const run = useAction()
  const shelters = useSelector(selectShelters).filter((s) => s.isActive)
  const [create, { isLoading }] = useCreateVolunteerRequestMutation()
  const [form, setForm] = useState({ shelterId: '', professions: ['doctor'], count: 1, urgency: 'normal', note: '' })

  const toggle = (p) =>
    setForm((f) => ({
      ...f,
      professions: f.professions.includes(p) ? f.professions.filter((x) => x !== p) : [...f.professions, p],
    }))

  const submit = async (e) => {
    e.preventDefault()
    const ok = await run(create({ ...form, count: Number(form.count) }), 'volunteers.toast.requested')
    if (ok) setForm((f) => ({ ...f, note: '' }))
  }

  return (
    <Card>
      <Card.Header title={t('volunteers.request.title')} subtitle={t('volunteers.request.subtitle')} icon={<Icon3D name="megaphone" size={26} />} />
      <form onSubmit={submit} className="space-y-3">
        <Select
          label={t('volunteers.request.shelter')}
          value={form.shelterId}
          onChange={(e) => setForm({ ...form, shelterId: e.target.value })}
          options={[
            { value: '', label: t('volunteers.request.chooseShelter') },
            ...shelters.map((s) => ({ value: s.id, label: s.name })),
          ]}
          required
        />
        <fieldset>
          <legend className="text-xs text-muted mb-1.5">{t('volunteers.request.professions')}</legend>
          <div className="flex flex-wrap gap-1.5">
            {PROFESSIONS.map((p) => (
              <button
                type="button"
                key={p}
                aria-pressed={form.professions.includes(p)}
                onClick={() => toggle(p)}
                className={`h-8 px-2.5 rounded-lg text-xs border cursor-pointer ${
                  form.professions.includes(p) ? 'bg-info text-white border-info' : 'bg-panel-2 text-muted border-border'
                }`}
              >
                {t(`volunteers.profession.${p}`)}
              </button>
            ))}
          </div>
        </fieldset>
        <div className="grid grid-cols-2 gap-3">
          <Input
            label={t('volunteers.request.count')}
            type="number"
            min={1}
            max={50}
            value={form.count}
            onChange={(e) => setForm({ ...form, count: e.target.value })}
          />
          <Select
            label={t('volunteers.request.urgency')}
            value={form.urgency}
            onChange={(e) => setForm({ ...form, urgency: e.target.value })}
            options={['normal', 'urgent'].map((u) => ({ value: u, label: t(`volunteers.urgency.${u}`) }))}
          />
        </div>
        <Input
          label={t('volunteers.request.note')}
          value={form.note}
          maxLength={280}
          onChange={(e) => setForm({ ...form, note: e.target.value })}
        />
        <Button
          type="submit"
          fullWidth
          loading={isLoading}
          disabled={!form.shelterId || !form.professions.length}
          leftIcon={<Send className="w-4 h-4" />}
        >
          {t('volunteers.request.send')}
        </Button>
      </form>
    </Card>
  )
}

const RequestsList = ({ sheltersById }) => {
  const { t } = useTranslation()
  const run = useAction()
  const canRequest = useCan('volunteers:request')
  const { data: requests = [] } = useGetVolunteerRequestsQuery(undefined, { pollingInterval: 15000 })
  const [cancel] = useCancelVolunteerRequestMutation()

  return (
    <Card padding="none">
      <div className="p-4 pb-2">
        <Card.Header title={t('volunteers.requests.title')} icon={<Icon3D name="bell" size={26} />} className="mb-0" />
      </div>
      {requests.length === 0 ? (
        <EmptyState icon="people" title={t('volunteers.requests.empty')} />
      ) : (
        <ul className="divide-y divide-border">
          {requests.map((r) => (
            <li key={r.id} className="px-4 py-3 flex flex-wrap items-center gap-2">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-text truncate">
                  {sheltersById[r.shelter]?.name ?? '—'}
                  {r.kind === 'medical_sos' && (
                    <Badge variant="critical" size="sm" className="ml-2">
                      <HeartPulse className="w-3 h-3" aria-hidden /> {t('volunteers.requests.medicalSos')}
                    </Badge>
                  )}
                </p>
                <p className="text-xs text-muted">
                  {r.professions.map((p) => t(`volunteers.profession.${p}`)).join(', ')} ·{' '}
                  {t(`volunteers.urgency.${r.urgency}`)} · {formatAgo(r.createdAt)}
                </p>
                <p className="text-xs text-muted mt-0.5">
                  {t('volunteers.requests.progress', {
                    accepted: r.acceptedCount,
                    count: r.count,
                    notified: r.notifiedCount,
                    declined: r.declinedCount,
                  })}
                  {r.notifiedByStage?.['2'] || r.notifiedByStage?.['3']
                    ? ` · ${t('volunteers.requests.widened')}`
                    : ''}
                </p>
              </div>
              <StatusBadge meta={REQUEST_STATUS[r.status]} label={t(`volunteers.requestStatus.${r.status}`)} />
              {canRequest && r.status === 'open' && (
                <Button size="sm" variant="ghost" onClick={() => run(cancel(r.id), 'volunteers.toast.cancelled')}>
                  {t('app.cancel')}
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}
    </Card>
  )
}

const VerificationQueue = () => {
  const { t } = useTranslation()
  const dispatch = useDispatch()
  const run = useAction()
  const token = useSelector((s) => s.auth.accessToken)
  const { data: queue = [] } = useGetVerificationQueueQuery()
  const [verify] = useVerifyVolunteerMutation()

  const open = async (v, d) => {
    try {
      await openVolunteerDocument(token, v.id, d.id)
    } catch {
      dispatch(toast.error('volunteers.toast.docFailed'))
    }
  }

  return (
    <Card padding="none">
      <div className="p-4 pb-2">
        <Card.Header
          title={t('volunteers.verification.title')}
          subtitle={t('volunteers.verification.subtitle')}
          icon={<Icon3D name="shield" size={26} />}
          className="mb-0"
        />
      </div>
      {queue.length === 0 ? (
        <EmptyState icon="safe" title={t('volunteers.verification.empty')} />
      ) : (
        <ul className="divide-y divide-border">
          {queue.map((v) => (
            <li key={v.id} className="px-4 py-3 space-y-2">
              <div className="flex items-center gap-2">
                <p className="text-sm font-semibold text-text flex-1">
                  {v.displayName || t('volunteers.anonymous', { ref: v.deviceRef })} · {t(`volunteers.profession.${v.profession}`)}
                </p>
                <StatusBadge meta={VERIFICATION[v.verification]} label={t(`volunteers.verificationStatus.${v.verification}`)} />
              </div>
              <div className="flex flex-wrap gap-1.5">
                {v.documentsList.map((d) => (
                  <Button key={d.id} size="sm" variant="secondary" onClick={() => open(v, d)} leftIcon={<FileText className="w-3.5 h-3.5" />}>
                    {d.originalName}
                  </Button>
                ))}
              </div>
              <div className="flex gap-2">
                <Button size="sm" variant="success" onClick={() => run(verify({ id: v.id, decision: 'verified' }), 'volunteers.toast.verified')}>
                  {t('volunteers.verification.approve')}
                </Button>
                <Button size="sm" variant="critical" onClick={() => run(verify({ id: v.id, decision: 'rejected' }), 'volunteers.toast.rejected')}>
                  {t('volunteers.verification.reject')}
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  )
}

/**
 * Professional volunteers network: roster (coarse location; exact only for
 * dispatchers and only for volunteers on an accepted request), requests with
 * live progress, medical-SOS call-out suggestions, verification queue.
 */
export const VolunteersPage = () => {
  const { t } = useTranslation()
  const run = useAction()
  const can = useCan()
  const shelters = useSelector(selectShelters)
  const sheltersById = useMemo(() => Object.fromEntries(shelters.map((s) => [s.id, s])), [shelters])
  const [filters, setFilters] = useState({ profession: '', availability: '', verification: '' })
  const [suggestions, setSuggestions] = useState([])
  const [notifyMedical] = useNotifyMedicalVolunteersMutation()

  const params = Object.fromEntries(Object.entries(filters).filter(([, v]) => v))
  const { data: volunteers = [], isLoading } = useGetVolunteersQuery(params, {
    pollingInterval: 20000,
    skip: !can('volunteers:read'),
  })

  const onMedicalSuggestion = useMemo(
    () => (s) => setSuggestions((list) => [s, ...list.filter((x) => x.sosId !== s.sosId)].slice(0, 5)),
    []
  )
  useVolunteerLive(onMedicalSuggestion)

  const stats = useMemo(
    () => ({
      total: volunteers.filter((v) => v.consent).length,
      ready: volunteers.filter((v) => v.consent && v.availability === 'ready').length,
      medical: volunteers.filter((v) => ['doctor', 'nurse', 'paramedic'].includes(v.profession) && v.consent).length,
      pending: volunteers.filter((v) => v.verification === 'pending').length,
    }),
    [volunteers]
  )

  return (
    <div className="p-4 space-y-4">
      <div className="grid gap-3 grid-cols-[repeat(auto-fit,minmax(170px,1fr))]">
        {[
          ['people', 'total'],
          ['safe', 'ready'],
          ['hospital', 'medical'],
          ['hourglass', 'pending'],
        ].map(([icon, key]) => (
          <Card key={key} className="flex items-center gap-3">
            <Icon3D name={icon} size={34} />
            <div>
              <p className="text-xs text-muted">{t(`volunteers.stats.${key}`)}</p>
              <p className="text-xl font-bold text-text tabular-nums">{stats[key]}</p>
            </div>
          </Card>
        ))}
      </div>

      {suggestions.length > 0 && can('volunteers:notify_medical') && (
        <Card className="border-critical/50">
          <Card.Header title={t('volunteers.medical.title')} subtitle={t('volunteers.medical.subtitle')} icon={<HeartPulse className="w-5 h-5 text-critical" />} />
          <ul className="space-y-2">
            {suggestions.map((s) => (
              <li key={s.sosId} className="flex items-center gap-2 text-sm">
                <span className="flex-1">{t('volunteers.medical.item', { nearby: s.nearby, time: formatAgo(s.at) })}</span>
                <Button
                  size="sm"
                  variant="critical"
                  onClick={async () => {
                    const ok = await run(notifyMedical(s.sosId), 'volunteers.toast.medicalNotified')
                    if (ok) setSuggestions((list) => list.filter((x) => x.sosId !== s.sosId))
                  }}
                >
                  {t('volunteers.medical.approve')}
                </Button>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_420px] gap-4 items-start">
        <div className="space-y-4 min-w-0">
          {can('volunteers:read') && (
            <Card padding="none">
              <div className="p-4 pb-3 flex flex-wrap items-end gap-2">
                <Card.Header title={t('volunteers.roster.title')} subtitle={t('volunteers.roster.privacy')} icon={<Icon3D name="people" size={26} />} className="mb-0 flex-1 min-w-60" />
                {[
                  ['profession', PROFESSIONS, 'volunteers.profession'],
                  ['availability', ['ready', 'not_ready'], 'volunteers.availability'],
                  ['verification', Object.keys(VERIFICATION), 'volunteers.verificationStatus'],
                ].map(([key, values, prefix]) => (
                  <Select
                    key={key}
                    aria-label={t(`volunteers.filter.${key}`)}
                    value={filters[key]}
                    onChange={(e) => setFilters({ ...filters, [key]: e.target.value })}
                    options={[
                      { value: '', label: t(`volunteers.filter.${key}`) },
                      ...values.map((v) => ({ value: v, label: t(`${prefix}.${v}`) })),
                    ]}
                  />
                ))}
              </div>
              {!isLoading && volunteers.length === 0 ? (
                <EmptyState icon="people" title={t('volunteers.roster.empty')} />
              ) : (
                <Table className="rounded-none border-x-0 border-b-0">
                  <Table.Head>
                    <tr>
                      <Table.Th>{t('volunteers.roster.name')}</Table.Th>
                      <Table.Th>{t('volunteers.roster.profession')}</Table.Th>
                      <Table.Th>{t('volunteers.roster.status')}</Table.Th>
                      <Table.Th>{t('volunteers.roster.verification')}</Table.Th>
                      <Table.Th>{t('volunteers.roster.location')}</Table.Th>
                    </tr>
                  </Table.Head>
                  <tbody>
                    {volunteers.map((v) => (
                      <Table.Row key={v.id}>
                        <Table.Td>
                          <span className="font-medium text-text">{v.displayName || t('volunteers.anonymous', { ref: v.deviceRef })}</span>
                          {!v.consent && <span className="ml-2 text-xs text-subtle">{t('volunteers.roster.withdrawn')}</span>}
                        </Table.Td>
                        <Table.Td>
                          {t(`volunteers.profession.${v.profession}`)}
                          {v.skills?.length > 0 && <p className="text-xs text-muted">{v.skills.join(', ')}</p>}
                        </Table.Td>
                        <Table.Td>
                          <StatusBadge meta={AVAILABILITY[v.availability]} label={t(`volunteers.availability.${v.availability}`)} />
                        </Table.Td>
                        <Table.Td>
                          {v.unverifiedMedical ? (
                            <StatusBadge meta={{ variant: 'warning', Icon: BadgeAlert }} label={t('volunteers.unverifiedBadge')} />
                          ) : (
                            <StatusBadge meta={VERIFICATION[v.verification]} label={t(`volunteers.verificationStatus.${v.verification}`)} />
                          )}
                        </Table.Td>
                        <Table.Td className="text-xs">
                          {v.exactLocation ? (
                            <span className="inline-flex items-center gap-1 text-info">
                              <MapPin className="w-3.5 h-3.5" aria-hidden />
                              {v.exactLocation.lat.toFixed(5)}, {v.exactLocation.lng.toFixed(5)}
                              <Badge size="sm" variant="info">{t('volunteers.roster.onAssignment')}</Badge>
                            </span>
                          ) : v.location ? (
                            <span className="text-muted">
                              {t(`volunteers.roster.coarse.${v.location.kind}`, { label: v.location.label })}
                            </span>
                          ) : (
                            <span className="text-subtle">—</span>
                          )}
                        </Table.Td>
                      </Table.Row>
                    ))}
                  </tbody>
                </Table>
              )}
            </Card>
          )}
          <RequestsList sheltersById={sheltersById} />
        </div>
        <div className="space-y-4">
          {can('volunteers:request') && <RequestForm />}
          {can('volunteers:verify') && <VerificationQueue />}
        </div>
      </div>
    </div>
  )
}
