import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Plus, Trash2, Wand2 } from 'lucide-react'

import { Button, Card, Icon3D, Input, Select } from '@components'
import { useAction } from '@store/hooks'
import { useCreateSupplyRequestMutation, useLazyGetEstimateQuery } from './api'
import { SUPPLY_KINDS } from './constants'

/**
 * Create a supply request. "Ehtiyacı hesabla" fills the items from the
 * shelter's occupancy (per-person ratios from the module config).
 * `shelters` = options for staff; omitted for a shelter manager (own shelter).
 */
export const RequestForm = ({ shelters, fixedShelterName }) => {
  const { t } = useTranslation()
  const run = useAction()
  const [shelterId, setShelterId] = useState(shelters?.[0]?.id ?? '')
  const [items, setItems] = useState([{ kind: 'water', quantity: '' }])
  const [priority, setPriority] = useState('normal')
  const [note, setNote] = useState('')
  const [estimateText, setEstimateText] = useState('')
  const [create, { isLoading }] = useCreateSupplyRequestMutation()
  const [loadEstimate, { isFetching: estimating }] = useLazyGetEstimateQuery()

  const setItem = (i, patch) => setItems((list) => list.map((it, idx) => (idx === i ? { ...it, ...patch } : it)))
  const unused = SUPPLY_KINDS.filter((k) => !items.some((i) => i.kind === k))

  const estimate = async () => {
    const res = await loadEstimate(shelters ? shelterId : undefined).unwrap().catch(() => null)
    if (!res) return
    if (res.items.length) setItems(res.items.map((i) => ({ kind: i.kind, quantity: String(i.quantity) })))
    setEstimateText(t('drones.estimateText', { people: res.people, kg: res.totalKg }))
  }

  const submit = async (e) => {
    e.preventDefault()
    const clean = items
      .map((i) => ({ kind: i.kind, quantity: Number(i.quantity) }))
      .filter((i) => Number.isFinite(i.quantity) && i.quantity > 0)
    if (!clean.length) return
    const ok = await run(
      create({ ...(shelters ? { shelterId } : {}), items: clean, priority, note }),
      'drones.toast.created'
    )
    if (ok) {
      setItems([{ kind: 'water', quantity: '' }])
      setNote('')
      setEstimateText('')
    }
  }

  return (
    <Card>
      <Card.Header
        title={t('drones.form.title')}
        subtitle={fixedShelterName ?? t('drones.form.subtitle')}
        icon={<Icon3D name="tent" size={28} />}
      />
      <form className="space-y-3" onSubmit={submit}>
        {shelters && (
          <Select
            id="supply-shelter"
            label={t('drones.form.shelter')}
            value={shelterId}
            onChange={(e) => setShelterId(e.target.value)}
            options={shelters.map((s) => ({ value: s.id, label: `${s.name} · ${Math.round(s.occupancyRate * 100)}%` }))}
          />
        )}

        <Button type="button" variant="secondary" size="sm" onClick={estimate} loading={estimating} leftIcon={<Wand2 className="w-4 h-4" />}>
          {t('drones.form.estimate')}
        </Button>
        {estimateText && <p className="text-xs text-info">{estimateText}</p>}

        <div className="space-y-2">
          {items.map((item, i) => (
            <div key={i} className="grid grid-cols-[1fr_120px_auto] gap-2 items-end">
              <Select
                id={`supply-kind-${i}`}
                label={i === 0 ? t('drones.form.kind') : undefined}
                value={item.kind}
                onChange={(e) => setItem(i, { kind: e.target.value })}
                options={[item.kind, ...unused].map((k) => ({ value: k, label: t(`drones.kind.${k}`) }))}
              />
              <Input
                id={`supply-qty-${i}`}
                label={i === 0 ? t('drones.form.quantity') : undefined}
                type="number"
                min="1"
                inputMode="numeric"
                value={item.quantity}
                onChange={(e) => setItem(i, { quantity: e.target.value })}
                placeholder={t(`drones.units.${item.kind}`)}
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                aria-label={t('drones.form.removeItem')}
                disabled={items.length === 1}
                onClick={() => setItems((list) => list.filter((_, idx) => idx !== i))}
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          ))}
          {unused.length > 0 && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              leftIcon={<Plus className="w-4 h-4" />}
              onClick={() => setItems((list) => [...list, { kind: unused[0], quantity: '' }])}
            >
              {t('drones.form.addItem')}
            </Button>
          )}
        </div>

        <Select
          id="supply-priority"
          label={t('drones.form.priority')}
          value={priority}
          onChange={(e) => setPriority(e.target.value)}
          options={['normal', 'urgent'].map((p) => ({ value: p, label: t(`drones.priority.${p}`) }))}
        />
        <Input id="supply-note" label={t('drones.form.note')} value={note} onChange={(e) => setNote(e.target.value)} maxLength={280} />

        <Button type="submit" fullWidth loading={isLoading} disabled={shelters && !shelterId}>
          {t('drones.form.submit')}
        </Button>
      </form>
    </Card>
  )
}
