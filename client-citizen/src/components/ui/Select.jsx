import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { clsx } from 'clsx'
import { Check, ChevronDown } from 'lucide-react'
import { Sheet } from './Sheet'

/**
 * Custom select (no native <select>): a pill button that opens a bottom
 * sheet with large, thumb-friendly options.
 *
 *   options [{ value, label, description? }] · value · onChange(value)
 */
export const Select = ({ label, options = [], value, onChange, placeholder, disabled, className }) => {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const selected = options.find((o) => String(o.value) === String(value ?? ''))

  return (
    <>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={label ? `${label}: ${selected?.label ?? placeholder ?? t('ui.select')}` : undefined}
        className={clsx(
          'flex h-12 w-full items-center gap-2 rounded-full bg-surface pl-5 pr-4 text-left text-sm font-semibold transition-colors',
          'hover:bg-surface-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink disabled:opacity-60',
          className
        )}
      >
        <span className={clsx('min-w-0 flex-1 truncate', selected ? 'text-ink' : 'text-muted')}>
          {selected?.label ?? placeholder ?? t('ui.select')}
        </span>
        <ChevronDown className="h-4 w-4 shrink-0 text-ink" aria-hidden />
      </button>

      <Sheet open={open} onClose={() => setOpen(false)} title={label ?? placeholder ?? t('ui.select')}>
        <ul role="listbox" aria-label={label ?? placeholder} className="space-y-1.5">
          {options.map((o) => {
            const on = String(o.value) === String(value ?? '')
            return (
              <li key={o.value} role="none">
                <button
                  type="button"
                  role="option"
                  aria-selected={on}
                  data-autofocus={on || undefined}
                  onClick={() => {
                    onChange?.(o.value)
                    setOpen(false)
                  }}
                  className={clsx(
                    'flex min-h-14 w-full items-center gap-3 rounded-2xl px-4 text-left transition-colors',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink',
                    on ? 'bg-ink text-white' : 'bg-surface text-ink hover:bg-surface-strong'
                  )}
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-bold">{o.label}</span>
                    {o.description && (
                      <span className={clsx('block truncate text-xs', on ? 'text-white/80' : 'text-muted')}>{o.description}</span>
                    )}
                  </span>
                  {on && <Check className="h-5 w-5 shrink-0" aria-hidden />}
                </button>
              </li>
            )
          })}
        </ul>
      </Sheet>
    </>
  )
}
