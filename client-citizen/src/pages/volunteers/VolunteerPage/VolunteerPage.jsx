import { useEffect, useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { useTranslation } from 'react-i18next'
import { clsx } from 'clsx'
import { FileUp, MapPin, ShieldOff, Navigation } from 'lucide-react'

import { Button, Card, Icon3D, StatusBadge, PageLoader, EmptyState, EvacuationMap, Select, useConfirm } from '@components'
import {
  baseApi,
  useGetSheltersQuery,
  useGetVolunteerQuery,
  useSaveVolunteerMutation,
  useWithdrawVolunteerMutation,
  useSetVolunteerAvailabilityMutation,
  useUpdateVolunteerLocationMutation,
  useGetVolunteerRequestsQuery,
  useAcceptVolunteerRequestMutation,
  useDeclineVolunteerRequestMutation,
  useUploadVolunteerDocumentMutation,
} from '@store/api'
import { selectDeviceId } from '@store/slices'
import { useSocket } from '@store/context'
import { useGeolocation } from '@hooks'
import { errorMessage, formatDistance, formatDuration } from '@utils'

const PROFESSIONS = ['doctor', 'nurse', 'paramedic', 'engineer', 'electrician', 'psychologist', 'rescuer', 'interpreter', 'other']
const MEDICAL = ['doctor', 'nurse', 'paramedic']

// Status = icon + text + colour
const VERIFICATION_META = {
  not_required: { tone: 'neutral', icon: 'check' },
  unverified: { tone: 'busy', icon: 'alert' },
  pending: { tone: 'info', icon: 'hourglass' },
  verified: { tone: 'ok', icon: 'shield' },
  rejected: { tone: 'sos', icon: 'alert' },
}

const field = 'h-12 w-full rounded-full bg-surface px-3 text-base text-ink focus:border-brand focus:outline-none'

/** Live updates from the device room; polling is the fallback. */
const useVolunteerLive = () => {
  const { socket } = useSocket()
  const dispatch = useDispatch()
  useEffect(() => {
    if (!socket) return
    const handler = (evt) => {
      if (!evt?.type?.startsWith('volunteer:')) return
      if (evt.type === 'volunteer:request') navigator.vibrate?.([200, 100, 200, 100, 200])
      dispatch(baseApi.util.invalidateTags(['VolunteerRequests']))
    }
    socket.on('evt', handler)
    return () => socket.off('evt', handler)
  }, [socket, dispatch])
}

const RegisterForm = ({ profile, deviceId }) => {
  const { t } = useTranslation()
  const [save, { isLoading, error }] = useSaveVolunteerMutation()
  const [form, setForm] = useState({
    profession: profile?.profession ?? '',
    skills: profile?.skills?.join(', ') ?? '',
    displayName: profile?.displayName ?? '',
    phone: profile?.phone ?? '',
    consent: profile?.consent?.given ?? false,
  })

  const submit = (e) => {
    e.preventDefault()
    save({
      deviceId,
      profession: form.profession,
      skills: form.skills.split(',').map((s) => s.trim()).filter(Boolean),
      displayName: form.displayName,
      phone: form.phone,
      consent: form.consent,
    })
  }

  return (
    <Card as="form" onSubmit={submit} className="space-y-4">
      <Card.Title>{profile ? t('volunteer.form.editTitle') : t('volunteer.form.title')}</Card.Title>
      <fieldset>
        <legend className="mb-2 text-sm font-bold text-ink">{t('volunteer.form.profession')}</legend>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {PROFESSIONS.map((p) => (
            <button
              key={p}
              type="button"
              aria-pressed={form.profession === p}
              onClick={() => setForm({ ...form, profession: p })}
              className={clsx(
                'min-h-12 rounded-xl border-2 px-2 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand',
                form.profession === p ? 'border-brand bg-brand text-white' : 'border-line-strong bg-surface text-ink'
              )}
            >
              {t(`volunteer.profession.${p}`)}
            </button>
          ))}
        </div>
        {MEDICAL.includes(form.profession) && (
          <p className="mt-2 rounded-lg bg-info-soft px-3 py-2 text-xs font-medium text-info">{t('volunteer.form.medicalNote')}</p>
        )}
      </fieldset>
      <label className="block text-sm font-bold text-ink">
        {t('volunteer.form.skills')}
        <input className={clsx(field, 'mt-1')} value={form.skills} onChange={(e) => setForm({ ...form, skills: e.target.value })} placeholder={t('volunteer.form.skillsHint')} />
      </label>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block text-sm font-bold text-ink">
          {t('volunteer.form.name')}
          <input className={clsx(field, 'mt-1')} value={form.displayName} maxLength={80} onChange={(e) => setForm({ ...form, displayName: e.target.value })} />
        </label>
        <label className="block text-sm font-bold text-ink">
          {t('volunteer.form.phone')}
          <input className={clsx(field, 'mt-1')} type="tel" value={form.phone} maxLength={32} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
        </label>
      </div>
      {!profile?.consent?.given && (
        <label className="flex min-h-12 items-start gap-3 rounded-xl border-2 border-line-strong p-3 text-sm text-ink">
          <input type="checkbox" aria-label={t('volunteer.form.consent')} className="mt-0.5 h-6 w-6 shrink-0 accent-brand" checked={form.consent} onChange={(e) => setForm({ ...form, consent: e.target.checked })} />
          <span>
            <strong className="block">{t('volunteer.form.consent')}</strong>
            <span className="text-muted">{t('volunteer.form.consentText')}</span>
          </span>
        </label>
      )}
      {error && <p role="alert" className="text-sm font-semibold text-sos">{errorMessage(error)}</p>}
      <Button type="submit" size="lg" fullWidth loading={isLoading} disabled={!form.profession || (!profile?.consent?.given && !form.consent)}>
        {profile?.consent?.given ? t('volunteer.form.save') : t('volunteer.form.join')}
      </Button>
    </Card>
  )
}

const StatusPanel = ({ profile, deviceId }) => {
  const { t } = useTranslation()
  const confirm = useConfirm()
  const [setAvailability, { isLoading }] = useSetVolunteerAvailabilityMutation()
  const [updateLocation, { isLoading: locating }] = useUpdateVolunteerLocationMutation()
  const [withdraw, { isLoading: withdrawing }] = useWithdrawVolunteerMutation()
  const [upload, { isLoading: uploading, error: uploadError }] = useUploadVolunteerDocumentMutation()
  const { data: shelters = [] } = useGetSheltersQuery()
  const { locate } = useGeolocation()
  const ready = profile.availability === 'ready'
  const v = VERIFICATION_META[profile.verification] ?? VERIFICATION_META.not_required

  const shareLocation = async () => {
    const pos = await locate()
    if (pos) updateLocation({ deviceId, ...pos })
  }

  return (
    <Card className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Icon3D name="hospital" size={40} />
        <div className="min-w-0 flex-1">
          <p className="font-bold text-ink">{t(`volunteer.profession.${profile.profession}`)}</p>
          <p className="text-xs text-muted">{profile.skills.join(', ')}</p>
        </div>
        <StatusBadge tone={v.tone} icon={v.icon}>
          {t(`volunteer.verification.${profile.verification}`)}
        </StatusBadge>
      </div>

      {/* One-tap readiness */}
      <button
        type="button"
        aria-pressed={ready}
        disabled={isLoading}
        onClick={() => setAvailability({ deviceId, availability: ready ? 'not_ready' : 'ready' })}
        className={clsx(
          'flex min-h-16 w-full items-center justify-center gap-3 rounded-2xl text-lg font-extrabold text-white focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand/40',
          ready ? 'bg-safe' : 'bg-ink-soft'
        )}
      >
        <StatusBadge tone={ready ? 'ok' : 'neutral'} icon={ready ? 'check' : 'clock'} size="lg" className="bg-white">
          {ready ? t('volunteer.ready') : t('volunteer.notReady')}
        </StatusBadge>
        <span>{ready ? t('volunteer.tapNotReady') : t('volunteer.tapReady')}</span>
      </button>

      <div className="grid gap-2 sm:grid-cols-2">
        <Button variant="outline" size="lg" onClick={shareLocation} loading={locating} leftIcon={<MapPin className="h-5 w-5" />}>
          {t('volunteer.shareLocation')}
        </Button>
        <Select
          label={t('volunteer.atShelter')}
          placeholder={t('volunteer.atShelter')}
          value={profile.currentShelter ?? ''}
          onChange={(v) => updateLocation({ deviceId, shelterId: v || null })}
          options={[{ value: '', label: t('volunteer.noShelter', { defaultValue: '—' }) }, ...shelters.map((s) => ({ value: s.id, label: s.name }))]}
        />
      </div>
      <p className="text-xs text-muted">{t('volunteer.locationPrivacy')}</p>

      {MEDICAL.includes(profile.profession) && (
        <div className="rounded-xl border border-line p-3">
          <p className="text-sm font-bold text-ink">{t('volunteer.docs.title')}</p>
          <p className="text-xs text-muted">{t('volunteer.docs.hint')}</p>
          <ul className="mt-2 space-y-1 text-sm">
            {profile.documents.map((d) => (
              <li key={d.id} className="text-ink-soft">
                📄 {d.originalName}
              </li>
            ))}
          </ul>
          <label className="mt-2 flex min-h-12 cursor-pointer items-center justify-center gap-2 rounded-xl border-2 border-dashed border-line-strong text-sm font-bold text-brand focus-within:ring-2 focus-within:ring-brand">
            <FileUp className="h-5 w-5" aria-hidden />
            {uploading ? t('volunteer.docs.uploading') : t('volunteer.docs.upload')}
            <input
              type="file"
              accept="application/pdf,image/png,image/jpeg"
              className="sr-only"
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (file) upload({ deviceId, file })
                e.target.value = ''
              }}
            />
          </label>
          {uploadError && <p role="alert" className="mt-1 text-sm font-semibold text-sos">{errorMessage(uploadError)}</p>}
        </div>
      )}

      <Button
        variant="ghost"
        fullWidth
        loading={withdrawing}
        leftIcon={<ShieldOff className="h-4 w-4" />}
        onClick={async () =>
          (await confirm({ message: t('volunteer.withdrawConfirm'), tone: 'danger', confirmLabel: t('volunteer.withdraw') })) &&
          withdraw(deviceId)
        }
      >
        {t('volunteer.withdraw')}
      </Button>
    </Card>
  )
}

const RequestCard = ({ request, deviceId }) => {
  const { t } = useTranslation()
  const [accept, { isLoading: accepting, error, data: accepted }] = useAcceptVolunteerRequestMutation()
  const [decline, { isLoading: declining }] = useDeclineVolunteerRequestMutation()
  const urgent = request.urgency === 'urgent'
  const mine = request.acceptedByMe || accepted

  return (
    <Card className={clsx('space-y-3', urgent && 'border-2 border-sos')}>
      <div className="flex items-start gap-3">
        <Icon3D name={request.kind === 'medical_sos' ? 'ambulance' : 'megaphone'} size={40} />
        <div className="min-w-0 flex-1">
          <p className="font-bold text-ink">{request.shelterInfo?.name ?? t('volunteer.requests.shelter')}</p>
          <p className="text-xs text-muted">{request.shelterInfo?.address}</p>
          <p className="mt-1 text-sm text-ink-soft">
            {request.professions.map((p) => t(`volunteer.profession.${p}`)).join(', ')}
          </p>
          {request.note && <p className="mt-1 text-sm text-ink">{request.note}</p>}
        </div>
        <StatusBadge tone={urgent ? 'sos' : 'info'} icon={urgent ? 'alert' : 'clock'}>
          {t(`volunteer.urgency.${request.urgency}`)}
        </StatusBadge>
      </div>

      {mine ? (
        <div className="space-y-2">
          <StatusBadge tone="ok" icon="check" size="lg">
            {t('volunteer.requests.acceptedByMe')}
          </StatusBadge>
          {accepted?.route && (
            <>
              <p className="flex items-center gap-2 text-sm font-semibold text-ink">
                <Navigation className="h-4 w-4 text-brand" aria-hidden />
                {formatDistance(accepted.route.distanceMeters)} · ~{formatDuration(accepted.route.durationSec)}
              </p>
              <EvacuationMap
                recommended={{ shelter: accepted.shelter, route: accepted.route }}
                shelters={[accepted.shelter]}
                className="h-56 rounded-2xl border border-line"
              />
            </>
          )}
          {accepted && !accepted.route && <p className="text-sm text-muted">{t('volunteer.requests.noRoute')}</p>}
        </div>
      ) : request.status !== 'open' ? (
        <StatusBadge tone="neutral" icon="clock">
          {t('volunteer.requests.closed')}
        </StatusBadge>
      ) : request.declinedByMe ? (
        <StatusBadge tone="neutral" icon="clock">
          {t('volunteer.requests.declined')}
        </StatusBadge>
      ) : (
        <div className="grid grid-cols-2 gap-2">
          <Button variant="safe" size="lg" loading={accepting} onClick={() => accept({ id: request.id, deviceId })}>
            {t('volunteer.requests.accept')}
          </Button>
          <Button variant="outline" size="lg" loading={declining} onClick={() => decline({ id: request.id, deviceId })}>
            {t('volunteer.requests.decline')}
          </Button>
          <p className="col-span-2 text-xs text-muted">{t('volunteer.requests.remaining', { count: request.remaining })}</p>
        </div>
      )}
      {error && <p role="alert" className="text-sm font-semibold text-sos">{errorMessage(error)}</p>}
    </Card>
  )
}

/**
 * Professional volunteer: optional registration with explicit consent,
 * one-tap Ready / Not ready, private location, document upload (medical),
 * incoming requests with accept → route to the assembly point.
 */
export const VolunteerPage = () => {
  const { t } = useTranslation()
  const deviceId = useSelector(selectDeviceId)
  const { data: profile, isLoading } = useGetVolunteerQuery(deviceId)
  const active = profile?.consent?.given === true
  const { data: requests = [] } = useGetVolunteerRequestsQuery(deviceId, { skip: !active, pollingInterval: 15000 })
  useVolunteerLive()

  return (
    <div className="mx-auto max-w-xl space-y-3">
      <div className="flex items-center gap-3">
        <Icon3D name="hospital" size={44} />
        <div>
          <h1 className="text-xl font-extrabold text-ink">{t('volunteer.title')}</h1>
          <p className="text-sm text-muted">{t('volunteer.intro')}</p>
        </div>
      </div>

      {isLoading ? (
        <PageLoader />
      ) : (
        <>
          {active && <StatusPanel profile={profile} deviceId={deviceId} />}
          {active && (
            <section aria-labelledby="vol-req" className="space-y-2">
              <h2 id="vol-req" className="text-base font-extrabold text-ink">
                {t('volunteer.requests.title')}
              </h2>
              {requests.length === 0 ? (
                <Card>
                  <EmptyState icon="bell" title={t('volunteer.requests.empty')} description={t('volunteer.requests.emptyHint')} />
                </Card>
              ) : (
                requests.map((r) => <RequestCard key={r.id} request={r} deviceId={deviceId} />)
              )}
            </section>
          )}
          <RegisterForm key={profile?.updatedAt ?? 'new'} profile={profile} deviceId={deviceId} />
        </>
      )}
    </div>
  )
}
