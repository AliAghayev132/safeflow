import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Plus } from 'lucide-react'

import { Button, Input, Select } from '@components'
import { useAction } from '@store/hooks'
import { useCreatePartnerMutation } from '@store/api/partnerApi'

const EMPTY = {
  name: '',
  type: 'other',
  contact: '',
  scopes: [],
  rateLimitPerMin: 120,
  requireMtls: false,
  fingerprints: '',
}

/** Register a partner organisation; returns credentials once (onCreated). */
export const CreatePartnerForm = ({ meta, onCreated, onCancel }) => {
  const { t } = useTranslation()
  const run = useAction()
  const [create, { isLoading }] = useCreatePartnerMutation()
  const [form, setForm] = useState(EMPTY)
  const set = (patch) => setForm((f) => ({ ...f, ...patch }))

  const toggleScope = (scope) =>
    set({ scopes: form.scopes.includes(scope) ? form.scopes.filter((s) => s !== scope) : [...form.scopes, scope] })

  const submit = async (e) => {
    e.preventDefault()
    const data = await run(
      create({
        name: form.name,
        type: form.type,
        contact: form.contact,
        scopes: form.scopes,
        rateLimitPerMin: Number(form.rateLimitPerMin),
        requireMtls: form.requireMtls,
        certFingerprints: form.fingerprints.split(/[\s,;]+/).filter(Boolean),
      }),
      'partners.toastCreated',
      { name: form.name }
    )
    if (data) {
      setForm(EMPTY)
      onCreated(data)
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4 rounded-xl border border-border bg-panel-2 p-4">
      <div className="grid gap-3 md:grid-cols-3">
        <Input
          id="partner-name"
          label={t('partners.name')}
          value={form.name}
          onChange={(e) => set({ name: e.target.value })}
          required
          maxLength={120}
        />
        <Select
          id="partner-type"
          label={t('partners.type')}
          value={form.type}
          onChange={(e) => set({ type: e.target.value })}
          options={(meta?.types ?? []).map((v) => ({ value: v, label: t(`partners.types.${v}`) }))}
        />
        <Input
          id="partner-contact"
          label={t('partners.contact')}
          value={form.contact}
          onChange={(e) => set({ contact: e.target.value })}
          maxLength={200}
        />
      </div>

      <fieldset>
        <legend className="mb-2 text-xs font-medium text-muted">{t('partners.scopes')}</legend>
        <div className="flex flex-wrap gap-2">
          {(meta?.scopes ?? []).map((scope) => (
            <label
              key={scope}
              className="flex min-h-10 cursor-pointer items-center gap-2 rounded-lg border border-border bg-panel px-3 text-sm"
            >
              <input type="checkbox" checked={form.scopes.includes(scope)} onChange={() => toggleScope(scope)} />
              <span className="font-mono text-xs">{scope}</span>
              <span className="text-xs text-muted">— {t(`partners.scopeDesc.${scope.replace(':', '_')}`)}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <div className="grid gap-3 md:grid-cols-3">
        <Input
          id="partner-rate"
          type="number"
          min={1}
          label={t('partners.rateLimit')}
          value={form.rateLimitPerMin}
          onChange={(e) => set({ rateLimitPerMin: e.target.value })}
        />
        <label className="flex min-h-11 items-center gap-2 self-end text-sm">
          <input type="checkbox" checked={form.requireMtls} onChange={(e) => set({ requireMtls: e.target.checked })} />
          {t('partners.requireMtls')}
        </label>
        {form.requireMtls && (
          <Input
            id="partner-fp"
            label={t('partners.fingerprints')}
            placeholder="AB:CD:…"
            value={form.fingerprints}
            onChange={(e) => set({ fingerprints: e.target.value })}
          />
        )}
      </div>

      <div className="flex justify-end gap-2">
        <Button variant="ghost" onClick={onCancel}>
          {t('app.cancel')}
        </Button>
        <Button
          type="submit"
          loading={isLoading}
          disabled={!form.name.trim() || !form.scopes.length}
          leftIcon={<Plus className="w-4 h-4" />}
        >
          {t('partners.create')}
        </Button>
      </div>
    </form>
  )
}
