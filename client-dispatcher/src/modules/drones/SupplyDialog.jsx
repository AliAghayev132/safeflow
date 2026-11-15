import { useState } from 'react'
import { useSelector } from 'react-redux'
import { useTranslation } from 'react-i18next'
import { clsx } from 'clsx'
import { Check, Droplets, Minus, Pill, Plus, Send, Siren, BriefcaseMedical, Utensils, Users } from 'lucide-react'

import { Badge, Button, Icon3D, Input, Modal, ProgressBar } from '@components'
import { selectShelterEntities } from '@store/slices/liveSlice'
import { useAction } from '@store/hooks'
import { useFeature, useCan } from '@hooks'
import { useCreateSupplyRequestMutation, useGetEstimateQuery } from './api'
import { closeSupplyDialog, openSupplyDialog, useSupplyDialog } from './supplyDialogStore'

// Solid icon tiles per supply kind (colour + icon + text, never colour alone)
const KIND_STYLE = {
  water: { Icon: Droplets, tile: 'bg-info text-white' },
  food: { Icon: Utensils, tile: 'bg-warning text-bg' },
  medicine: { Icon: Pill, tile: 'bg-critical text-white' },
  first_aid: { Icon: BriefcaseMedical, tile: 'bg-success text-white' },
}

const NeedCard = ({ need, picked, qty, onToggle, onQty }) => {
  const { t } = useTranslation()
  const style = KIND_STYLE[need.kind] ?? KIND_STYLE.water
  const covered = need.quantity ? Math.min(1, need.outstanding / need.quantity) : 1
  const step = need.kind === 'water' ? 50 : need.kind === 'food' ? 20 : 1

  return (
    <div
      className={clsx(
        'rounded-xl border-2 p-3 transition-colors',
        picked ? 'border-info bg-info-soft' : 'border-border bg-panel-2'
      )}
    >
      <button
        type="button"
        role="checkbox"
        aria-checked={picked}
        onClick={onToggle}
        className="flex w-full items-start gap-3 text-left cursor-pointer focus:outline-none"
      >
        <span className={clsx('flex h-11 w-11 shrink-0 items-center justify-center rounded-xl', style.tile)}>
          <style.Icon className="h-5 w-5" aria-hidden />
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-2">
            <span className="text-sm font-bold text-text">{t(`drones.kind.${need.kind}`)}</span>
            {need.missing === 0 && (
              <Badge size="sm" variant="success">
                {t('supplyDialog.covered')}
              </Badge>
            )}
          </span>
          <span className="mt-0.5 block text-xs text-muted">
            {t('supplyDialog.need', { qty: need.quantity, unit: t(`drones.units.${need.kind}`) })}
          </span>
          {need.outstanding > 0 && (
            <span className="block text-xs text-warning">
              {t('supplyDialog.onTheWay', { qty: need.outstanding })}
            </span>
          )}
        </span>
        <span
          className={clsx(
            'flex h-6 w-6 shrink-0 items-center justify-center rounded-md border-2',
            picked ? 'border-info bg-info text-white' : 'border-border-strong'
          )}
          aria-hidden
        >
          {picked && <Check className="h-4 w-4" />}
        </span>
      </button>

      <ProgressBar value={covered} color={covered >= 1 ? 'var(--color-success)' : 'var(--color-warning)'} className="mt-3" />

      {picked && (
        <div className="mt-3 flex items-center gap-2">
          <button
            type="button"
            onClick={() => onQty(Math.max(1, qty - step))}
            aria-label={t('supplyDialog.less')}
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-border-strong bg-panel text-text hover:bg-panel-3 cursor-pointer"
          >
            <Minus className="h-4 w-4" />
          </button>
          <input
            type="number"
            min="1"
            inputMode="numeric"
            value={qty}
            onChange={(e) => onQty(Math.max(0, Math.round(Number(e.target.value) || 0)))}
            aria-label={t('drones.form.quantity')}
            className="h-9 w-full min-w-0 rounded-lg border border-border bg-panel px-3 text-center text-sm font-bold tabular-nums text-text focus:border-info focus:outline-none"
          />
          <button
            type="button"
            onClick={() => onQty(qty + step)}
            aria-label={t('supplyDialog.more')}
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-border-strong bg-panel text-text hover:bg-panel-3 cursor-pointer"
          >
            <Plus className="h-4 w-4" />
          </button>
          {need.missing > 0 && qty !== need.missing && (
            <button
              type="button"
              onClick={() => onQty(need.missing)}
              className="h-9 shrink-0 rounded-lg px-2 text-xs font-semibold text-info hover:bg-panel-3 cursor-pointer"
            >
              {t('supplyDialog.fillMissing')}
            </button>
          )}
        </div>
      )}
    </div>
  )
}

const SupplyDialogBody = ({ shelterId }) => {
  const { t } = useTranslation()
  const run = useAction()
  const shelter = useSelector(selectShelterEntities)[shelterId]
  const { data: estimate, isFetching } = useGetEstimateQuery(shelterId, { refetchOnMountOrArgChange: true })
  const [create, { isLoading }] = useCreateSupplyRequestMutation()
  // kind → quantity; null = default selection (everything still missing)
  const [choice, setPicked] = useState(null)
  const [priority, setPriority] = useState('normal')
  const [note, setNote] = useState('')

  const needs = estimate?.needs ?? []
  const picked = choice ?? Object.fromEntries(needs.filter((n) => n.missing > 0).map((n) => [n.kind, n.missing]))
  const items = Object.entries(picked)
    .filter(([, q]) => q > 0)
    .map(([kind, quantity]) => ({ kind, quantity }))
  const totalKg =
    Math.round(items.reduce((sum, i) => sum + i.quantity * (needs.find((n) => n.kind === i.kind)?.unitWeightKg ?? 1), 0) * 10) /
    10

  const submit = async () => {
    const ok = await run(create({ shelterId, items, priority, note }), 'drones.toast.created')
    if (ok) closeSupplyDialog()
  }

  const rate = shelter?.occupancyRate ?? (estimate ? estimate.people / Math.max(1, estimate.shelter.capacity) : 0)

  return (
    <Modal
      open
      onClose={closeSupplyDialog}
      size="lg"
      icon={<Icon3D name="helicopter" size={40} />}
      title={t('supplyDialog.title', { name: shelter?.name ?? estimate?.shelter.name ?? '' })}
      subtitle={
        <span className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1">
            <Users className="h-3.5 w-3.5" />
            {t('supplyDialog.people', {
              people: estimate?.people ?? shelter?.occupancy ?? 0,
              capacity: estimate?.shelter.capacity ?? shelter?.capacity ?? 0,
            })}
          </span>
          <Badge size="sm" variant={rate >= 0.9 ? 'critical' : rate >= 0.7 ? 'warning' : 'success'}>
            {Math.round(rate * 100)}%
          </Badge>
          {estimate?.openRequests > 0 && (
            <Badge size="sm" variant="info">
              {t('supplyDialog.openRequests', { count: estimate.openRequests })}
            </Badge>
          )}
        </span>
      }
      footer={
        <div className="flex flex-wrap items-center gap-3">
          <div className="mr-auto">
            <p className="text-[11px] uppercase tracking-wide text-muted">{t('supplyDialog.load')}</p>
            <p className="text-lg font-extrabold tabular-nums text-text">{totalKg} kg</p>
          </div>
          <Button variant="secondary" onClick={closeSupplyDialog}>
            {t('ui.cancel')}
          </Button>
          <Button
            variant={priority === 'urgent' ? 'critical' : 'primary'}
            loading={isLoading}
            disabled={!items.length}
            onClick={submit}
            leftIcon={<Send className="h-4 w-4" />}
          >
            {t('supplyDialog.send', { count: items.length })}
          </Button>
        </div>
      }
    >
      <p className="mb-3 text-sm font-semibold text-text">{t('supplyDialog.needsTitle')}</p>
      {isFetching && !estimate ? (
        <div className="grid gap-3 sm:grid-cols-2">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-32 animate-pulse rounded-xl bg-panel-2" />
          ))}
        </div>
      ) : needs.length === 0 ? (
        <p className="rounded-xl border border-border bg-panel-2 p-4 text-sm text-muted">{t('supplyDialog.empty')}</p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {needs.map((n) => (
            <NeedCard
              key={n.kind}
              need={n}
              picked={n.kind in picked}
              qty={picked[n.kind] ?? 0}
              onToggle={() =>
                setPicked(() => {
                  const next = { ...picked }
                  if (n.kind in next) delete next[n.kind]
                  else next[n.kind] = Math.max(1, n.missing || Math.ceil(n.quantity / 4))
                  return next
                })
              }
              onQty={(q) => setPicked({ ...picked, [n.kind]: q })}
            />
          ))}
        </div>
      )}

      <p className="mb-2 mt-5 text-sm font-semibold text-text">{t('drones.form.priority')}</p>
      <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label={t('drones.form.priority')}>
        {['normal', 'urgent'].map((p) => (
          <button
            key={p}
            type="button"
            role="radio"
            aria-checked={priority === p}
            onClick={() => setPriority(p)}
            className={clsx(
              'flex h-11 items-center justify-center gap-2 rounded-xl border-2 text-sm font-bold cursor-pointer transition-colors',
              priority === p
                ? p === 'urgent'
                  ? 'border-critical bg-critical text-white'
                  : 'border-info bg-info text-white'
                : 'border-border bg-panel-2 text-muted hover:text-text'
            )}
          >
            {p === 'urgent' && <Siren className="h-4 w-4" />}
            {t(`drones.priority.${p}`)}
          </button>
        ))}
      </div>

      <Input
        id="supply-dialog-note"
        className="mt-4"
        label={t('drones.form.note')}
        value={note}
        maxLength={280}
        onChange={(e) => setNote(e.target.value)}
      />
    </Modal>
  )
}

/** Dialog host — mounted once in the layout through the module slot. */
export const SupplyDialogHost = () => {
  const shelterId = useSupplyDialog()
  const enabled = useFeature('drones')
  if (!shelterId || !enabled) return null
  return <SupplyDialogBody key={shelterId} shelterId={shelterId} />
}

/** "Request drone" action for an assembly point (map popup, shelters list). */
export const RequestDroneButton = ({ shelter, compact }) => {
  const { t } = useTranslation()
  const enabled = useFeature('drones')
  const can = useCan('supplies:request')
  if (!enabled || !can || !shelter?.isActive) return null
  return (
    <Button
      size="sm"
      variant={compact ? 'secondary' : 'primary'}
      onClick={() => openSupplyDialog(shelter.id)}
      leftIcon={<Icon3D name="helicopter" size={16} />}
      className={compact ? undefined : 'w-full'}
    >
      {t('supplyDialog.open')}
    </Button>
  )
}
