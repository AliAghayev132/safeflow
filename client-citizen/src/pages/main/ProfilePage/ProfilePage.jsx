import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useSelector } from 'react-redux'
import { Plus, Trash2 } from 'lucide-react'

import { Button, Card, Icon3D, PageLoader } from '@components'
import { ModuleLinks } from '@components/ModuleLinks'
import { AccessibilityFields, emptyAccessibility, toAccessibility } from '@/modules/accessibility'
import { useGetProfileQuery, useSaveProfileMutation, useDeleteProfileMutation } from '@store/api'
import { selectDeviceId, selectIsOffline } from '@store/slices'
import { errorMessage } from '@utils'

const inputCls =
  'h-12 w-full rounded-xl border-2 border-line-strong bg-surface px-3 text-sm text-ink focus:border-brand focus:outline-none'
const areaCls =
  'min-h-20 w-full rounded-xl border-2 border-line-strong bg-surface px-3 py-2 text-sm text-ink focus:border-brand focus:outline-none'

const toLines = (list) => (list ?? []).join('\n')
const fromLines = (text) => text.split('\n').map((s) => s.trim()).filter(Boolean)

const EMPTY = {
  fullName: '',
  phone: '',
  birthYear: '',
  bloodType: '',
  conditions: '',
  allergies: '',
  medications: '',
  emergencyContacts: [],
  accessibility: emptyAccessibility(),
}

const toForm = (p) =>
  p
    ? {
        fullName: p.fullName ?? '',
        phone: p.phone ?? '',
        birthYear: p.birthYear ?? '',
        bloodType: p.bloodType ?? '',
        conditions: toLines(p.conditions),
        allergies: toLines(p.allergies),
        medications: toLines(p.medications),
        emergencyContacts: p.emergencyContacts ?? [],
        accessibility: toAccessibility(p.accessibility),
      }
    : EMPTY

const Field = ({ id, label, hint, children }) => (
  <div>
    <label htmlFor={id} className="mb-1 block text-sm font-bold text-ink">
      {label}
      {hint && <span className="ml-1 text-xs font-medium text-muted">({hint})</span>}
    </label>
    {children}
  </div>
)

/** Optional profile — never required for SOS. */
const ProfileForm = ({ profile }) => {
  const { t, i18n } = useTranslation()
  const deviceId = useSelector(selectDeviceId)
  const offline = useSelector(selectIsOffline)
  const [form, setForm] = useState(() => toForm(profile))
  const [save, { isLoading: saving }] = useSaveProfileMutation()
  const [remove, { isLoading: removing }] = useDeleteProfileMutation()
  const [feedback, setFeedback] = useState(null)

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }))
  const setContact = (i, key, value) =>
    setForm((f) => ({
      ...f,
      emergencyContacts: f.emergencyContacts.map((c, idx) => (idx === i ? { ...c, [key]: value } : c)),
    }))

  const submit = async (e) => {
    e.preventDefault()
    setFeedback(null)
    try {
      await save({
        deviceId,
        fullName: form.fullName,
        phone: form.phone,
        birthYear: form.birthYear === '' ? null : Number(form.birthYear),
        bloodType: form.bloodType,
        conditions: fromLines(form.conditions),
        allergies: fromLines(form.allergies),
        medications: fromLines(form.medications),
        emergencyContacts: form.emergencyContacts.filter((c) => c.name || c.phone),
        language: i18n.language,
        // Special needs — attached to every SOS and raise its priority
        accessibility: toAccessibility(form.accessibility),
      }).unwrap()
      setFeedback({ ok: true, text: t('profile.saved') })
    } catch (error) {
      setFeedback({ ok: false, text: errorMessage(error) })
    }
  }

  const destroy = async () => {
    try {
      await remove(deviceId).unwrap()
      setForm(EMPTY)
      setFeedback({ ok: true, text: t('profile.deleted') })
    } catch (error) {
      setFeedback({ ok: false, text: errorMessage(error) })
    }
  }

  return (
    <form onSubmit={submit} className="stagger space-y-3">
      <Card className="space-y-3">
        <Card.Title>{t('profile.personal')}</Card.Title>
        <Field id="fullName" label={t('profile.fullName')}>
          <input id="fullName" className={inputCls} value={form.fullName} onChange={set('fullName')} autoComplete="name" />
        </Field>
        <Field id="phone" label={t('profile.phone')}>
          <input id="phone" type="tel" className={inputCls} value={form.phone} onChange={set('phone')} autoComplete="tel" />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field id="birthYear" label={t('profile.birthYear')}>
            <input id="birthYear" type="number" inputMode="numeric" min="1900" max="2100" className={inputCls} value={form.birthYear} onChange={set('birthYear')} />
          </Field>
          <Field id="bloodType" label={t('profile.bloodType')}>
            <input id="bloodType" maxLength={4} className={inputCls} value={form.bloodType} onChange={set('bloodType')} />
          </Field>
        </div>
      </Card>

      <Card className="space-y-3">
        <AccessibilityFields
          value={form.accessibility}
          onChange={(accessibility) => setForm((f) => ({ ...f, accessibility }))}
        />
      </Card>

      <Card className="space-y-3">
        <Card.Title>{t('profile.medical')}</Card.Title>
        {['conditions', 'allergies', 'medications'].map((key) => (
          <Field key={key} id={key} label={t(`profile.${key}`)} hint={t('profile.listHint')}>
            <textarea id={key} className={areaCls} value={form[key]} onChange={set(key)} />
          </Field>
        ))}
      </Card>

      <Card className="space-y-3">
        <Card.Title>{t('profile.contacts')}</Card.Title>
        {form.emergencyContacts.map((c, i) => (
          <div key={i} className="grid grid-cols-[1fr_1fr_auto] gap-2">
            <input aria-label={t('profile.contactName')} placeholder={t('profile.contactName')} className={inputCls} value={c.name} onChange={(e) => setContact(i, 'name', e.target.value)} />
            <input aria-label={t('profile.contactPhone')} placeholder={t('profile.contactPhone')} type="tel" className={inputCls} value={c.phone} onChange={(e) => setContact(i, 'phone', e.target.value)} />
            <button
              type="button"
              aria-label={t('profile.remove')}
              onClick={() => setForm((f) => ({ ...f, emergencyContacts: f.emergencyContacts.filter((_, idx) => idx !== i) }))}
              className="flex h-12 w-12 items-center justify-center rounded-xl border-2 border-line-strong text-sos"
            >
              <Trash2 className="h-4 w-4" />
            </button>
            <input aria-label={t('profile.contactRelation')} placeholder={t('profile.contactRelation')} className={`${inputCls} col-span-3`} value={c.relation} onChange={(e) => setContact(i, 'relation', e.target.value)} />
          </div>
        ))}
        {form.emergencyContacts.length < 5 && (
          <Button
            variant="outline"
            leftIcon={<Plus className="h-4 w-4" />}
            onClick={() => setForm((f) => ({ ...f, emergencyContacts: [...f.emergencyContacts, { name: '', phone: '', relation: '' }] }))}
          >
            {t('profile.addContact')}
          </Button>
        )}
      </Card>

      {offline && <p className="rounded-lg bg-warn-soft px-3 py-2 text-xs font-semibold text-warn">{t('profile.offlineNote')}</p>}
      {feedback && (
        <p role="status" className={`rounded-lg px-3 py-2 text-xs font-semibold ${feedback.ok ? 'bg-safe-soft text-safe' : 'bg-sos-soft text-sos'}`}>
          {feedback.text}
        </p>
      )}

      <div className="grid grid-cols-2 gap-2">
        <Button type="submit" size="lg" loading={saving} disabled={offline}>
          {t('common.save')}
        </Button>
        <Button variant="outline" size="lg" loading={removing} disabled={offline || !profile} onClick={destroy}>
          {t('profile.deleteAll')}
        </Button>
      </div>
    </form>
  )
}

export const ProfilePage = () => {
  const { t } = useTranslation()
  const deviceId = useSelector(selectDeviceId)
  const { data: profile, isLoading } = useGetProfileQuery(deviceId)

  return (
    <div className="mx-auto max-w-xl space-y-3">
      <div className="flex items-center gap-3">
        <Icon3D name="people" size={44} />
        <div>
          <h1 className="text-xl font-extrabold text-ink">{t('profile.title')}</h1>
          <p className="text-sm text-muted">{t('profile.intro')}</p>
        </div>
      </div>
      <ModuleLinks />
      {isLoading ? <PageLoader /> : <ProfileForm key={profile?.updatedAt ?? 'new'} profile={profile} />}
    </div>
  )
}
