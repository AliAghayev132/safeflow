import { useMemo, useRef, useState } from 'react'
import { useSelector } from 'react-redux'
import { useTranslation } from 'react-i18next'
import { clsx } from 'clsx'
import { Check, ChevronDown, Send, Users } from 'lucide-react'
import { selectBrigades } from '@store/slices/liveSlice'
import { BRIGADE_TYPES } from '@constants'
import { Popover } from '../ui/Popover'
import { Button } from '../ui/Button'
import { Icon3D } from '../ui/Icon3D'

const R = 6371000
const rad = (d) => (d * Math.PI) / 180
const distance = (a, b) => {
  const dLat = rad(b.lat - a.lat)
  const dLng = rad(b.lng - a.lng)
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(h))
}
// Same default as the backend simulation (config brigade.speedKmh)
const SPEED_MPS = (40 * 1000) / 3600
const fmtKm = (m) => (m < 1000 ? `${Math.round(m)} m` : `${(m / 1000).toFixed(1)} km`)

/**
 * Pick one or several available brigades for an incident.
 *
 *   target        { lat, lng } — sorts by distance and estimates ETA
 *   preferredType brigade type matching the incident (shown first, badged)
 *   exclude       ids already on the incident (reinforcement mode)
 *   max           per-incident cap (config brigade.maxPerIncident)
 *   onSubmit(ids) dispatch callback — the picker closes when it resolves truthy
 */
export const BrigadePicker = ({
  target,
  preferredType,
  exclude = [],
  max = 6,
  onSubmit,
  loading = false,
  label,
  submitLabel,
  size = 'sm',
  variant = 'secondary',
  disabled = false,
}) => {
  const { t } = useTranslation()
  const anchor = useRef(null)
  const brigades = useSelector(selectBrigades)
  const [open, setOpen] = useState(false)
  const [picked, setPicked] = useState([])
  const limit = Math.max(0, max - exclude.length)

  const options = useMemo(() => {
    const skip = new Set(exclude)
    return brigades
      .filter((b) => b.status === 'available' && !skip.has(b.id))
      .map((b) => {
        const d = target ? distance(target, b) : null
        return { ...b, distance: d, etaMin: d == null ? null : Math.max(1, Math.round(d / SPEED_MPS / 60)) }
      })
      .sort(
        (a, b) =>
          Number(b.type === preferredType) - Number(a.type === preferredType) || (a.distance ?? 0) - (b.distance ?? 0)
      )
  }, [brigades, exclude, target, preferredType])

  const toggle = (id) =>
    setPicked((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : cur.length >= limit ? cur : [...cur, id]))

  const submit = async () => {
    const ok = await onSubmit(picked)
    if (ok) {
      setPicked([])
      setOpen(false)
    }
  }

  const none = options.length === 0
  return (
    <>
      <Button
        ref={anchor}
        size={size}
        variant={variant}
        disabled={disabled || none || limit === 0}
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-haspopup="dialog"
        leftIcon={<Users className="h-3.5 w-3.5" />}
        rightIcon={<ChevronDown className={clsx('h-3.5 w-3.5 transition-transform', open && 'rotate-180')} />}
        title={none ? t('brigadePicker.noneFree') : undefined}
      >
        {label ?? t('brigadePicker.choose')}
      </Button>

      <Popover
        open={open}
        onClose={() => setOpen(false)}
        anchorRef={anchor}
        width={360}
        label={label ?? t('brigadePicker.choose')}
      >
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <div>
            <p className="text-sm font-bold text-text">{t('brigadePicker.title')}</p>
            <p className="text-xs text-muted">{t('brigadePicker.hint', { max: limit })}</p>
          </div>
          <span className="rounded-full bg-panel-3 px-2.5 py-1 text-xs font-bold tabular-nums text-text">
            {picked.length}/{limit}
          </span>
        </div>

        <ul className="flex-1 overflow-y-auto p-1.5" aria-label={t('brigadePicker.title')}>
          {options.map((b) => {
            const checked = picked.includes(b.id)
            const full = !checked && picked.length >= limit
            const meta = BRIGADE_TYPES?.[b.type]
            return (
              <li key={b.id}>
                <button
                  type="button"
                  role="checkbox"
                  aria-checked={checked}
                  disabled={full}
                  onClick={() => toggle(b.id)}
                  className={clsx(
                    'flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left transition-colors',
                    checked ? 'bg-info-soft' : 'hover:bg-panel-2',
                    full && 'cursor-not-allowed opacity-40'
                  )}
                >
                  <span
                    className={clsx(
                      'flex h-5 w-5 shrink-0 items-center justify-center rounded-md border',
                      checked ? 'border-info bg-info text-white' : 'border-border-strong bg-panel-2'
                    )}
                    aria-hidden
                  >
                    {checked && <Check className="h-3.5 w-3.5" />}
                  </span>
                  <Icon3D name={meta?.icon ?? 'fireEngine'} size={22} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-text">{b.name}</span>
                    <span className="block text-xs text-muted">
                      {t(`brigadeType.${b.type}`)}
                      {b.members ? ` · ${t('brigadePicker.members', { count: b.members })}` : ''}
                    </span>
                  </span>
                  <span className="shrink-0 text-right">
                    {b.etaMin != null && (
                      <span className="block text-xs font-bold tabular-nums text-text">
                        {t('suggest.eta', { minutes: b.etaMin })}
                      </span>
                    )}
                    {b.distance != null && (
                      <span className="block text-[11px] tabular-nums text-subtle">{fmtKm(b.distance)}</span>
                    )}
                  </span>
                  {b.type === preferredType && (
                    <span className="sr-only">{t('brigadePicker.matches')}</span>
                  )}
                </button>
              </li>
            )
          })}
          {none && <li className="px-3 py-4 text-center text-sm text-muted">{t('brigadePicker.noneFree')}</li>}
        </ul>

        <div className="flex items-center justify-end gap-2 border-t border-border px-3 py-3">
          <Button size="sm" variant="ghost" onClick={() => setPicked([])} disabled={!picked.length}>
            {t('brigadePicker.clear')}
          </Button>
          <Button
            size="sm"
            variant="critical"
            loading={loading}
            disabled={!picked.length}
            onClick={submit}
            leftIcon={<Send className="h-3.5 w-3.5" />}
          >
            {submitLabel ?? t('brigadePicker.send', { count: picked.length })}
          </Button>
        </div>
      </Popover>
    </>
  )
}
