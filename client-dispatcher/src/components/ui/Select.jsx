import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { clsx } from 'clsx'
import { Check, ChevronDown, Search } from 'lucide-react'
import { useTranslation } from 'react-i18next'

/**
 * Custom select (no native <select>): button + listbox popover rendered in a
 * portal, so it is never clipped by tables, cards or map popups.
 *
 * Keyboard: ↑/↓ move, Home/End, Enter/Space choose, Esc closes, typing
 * jumps to the first match (or filters when `searchable`).
 *
 * API (drop-in for the old native one):
 *   options   [{ value, label, description?, icon?, disabled? }]
 *   value     current value
 *   onChange  called with an event-like { target: { value } } (compat)
 *   onValueChange(value) — preferred
 */
const SIZES = {
  sm: 'h-8 text-xs px-2.5',
  md: 'h-10 text-sm px-3',
}

export const Select = ({
  label,
  options = [],
  value,
  onChange,
  onValueChange,
  placeholder,
  disabled = false,
  searchable,
  size = 'md',
  className,
  buttonClassName,
  id,
  'aria-label': ariaLabel,
  name,
  required,
}) => {
  const { t } = useTranslation()
  const autoId = useId()
  const buttonId = id ?? `sel-${autoId}`
  const listId = `${buttonId}-list`
  const buttonRef = useRef(null)
  const listRef = useRef(null)
  const typeahead = useRef({ text: '', at: 0 })
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(-1)
  const [query, setQuery] = useState('')
  const [pos, setPos] = useState(null)

  const canSearch = searchable ?? options.length > 8
  const selected = options.find((o) => String(o.value) === String(value ?? ''))
  const visible = useMemo(() => {
    const q = query.trim().toLowerCase()
    return q ? options.filter((o) => String(o.label).toLowerCase().includes(q)) : options
  }, [options, query])

  const place = useCallback(() => {
    const r = buttonRef.current?.getBoundingClientRect()
    if (!r) return
    const spaceBelow = window.innerHeight - r.bottom
    const maxHeight = 300
    const up = spaceBelow < Math.min(maxHeight, 48 + options.length * 40) && r.top > spaceBelow
    setPos({
      left: r.left,
      width: Math.max(r.width, 200),
      top: up ? undefined : r.bottom + 6,
      bottom: up ? window.innerHeight - r.top + 6 : undefined,
      maxHeight: Math.min(maxHeight, (up ? r.top : spaceBelow) - 16),
    })
  }, [options.length])

  const openList = () => {
    if (disabled) return
    place()
    setQuery('')
    setActive(Math.max(0, options.findIndex((o) => String(o.value) === String(value ?? ''))))
    setOpen(true)
  }
  const close = (focus = true) => {
    setOpen(false)
    if (focus) buttonRef.current?.focus()
  }

  const choose = (opt) => {
    if (!opt || opt.disabled) return
    onValueChange?.(opt.value)
    onChange?.({ target: { value: opt.value, name }, currentTarget: { value: opt.value, name } })
    close()
  }

  // Close on outside click / scroll / resize
  useEffect(() => {
    if (!open) return
    const onDown = (e) => {
      if (buttonRef.current?.contains(e.target) || listRef.current?.contains(e.target)) return
      close(false)
    }
    const onScroll = (e) => {
      if (listRef.current?.contains(e.target)) return
      place()
    }
    document.addEventListener('mousedown', onDown)
    window.addEventListener('resize', place)
    window.addEventListener('scroll', onScroll, true)
    return () => {
      document.removeEventListener('mousedown', onDown)
      window.removeEventListener('resize', place)
      window.removeEventListener('scroll', onScroll, true)
    }
  }, [open, place])

  // Keep the active option in view
  useLayoutEffect(() => {
    if (!open || active < 0) return
    listRef.current?.querySelector(`[data-index="${active}"]`)?.scrollIntoView({ block: 'nearest' })
  }, [open, active])

  const move = (delta) => {
    if (!visible.length) return
    let i = active
    for (let n = 0; n < visible.length; n++) {
      i = (i + delta + visible.length) % visible.length
      if (!visible[i].disabled) break
    }
    setActive(i)
  }

  const onKeyDown = (e) => {
    if (!open) {
      if (['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(e.key)) {
        e.preventDefault()
        openList()
      }
      return
    }
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        move(1)
        break
      case 'ArrowUp':
        e.preventDefault()
        move(-1)
        break
      case 'Home':
        e.preventDefault()
        setActive(0)
        break
      case 'End':
        e.preventDefault()
        setActive(visible.length - 1)
        break
      case 'Enter':
        e.preventDefault()
        choose(visible[active])
        break
      case ' ':
        if (canSearch) return
        e.preventDefault()
        choose(visible[active])
        break
      case 'Escape':
      case 'Tab':
        close(e.key === 'Escape')
        break
      default:
        if (!canSearch && e.key.length === 1) {
          const now = Date.now()
          const ta = typeahead.current
          ta.text = now - ta.at > 700 ? e.key.toLowerCase() : ta.text + e.key.toLowerCase()
          ta.at = now
          const i = visible.findIndex((o) => String(o.label).toLowerCase().startsWith(ta.text))
          if (i >= 0) setActive(i)
        }
    }
  }

  return (
    <div className={clsx('flex flex-col gap-1.5', className)}>
      {label && (
        <label htmlFor={buttonId} className="text-xs font-medium text-muted">
          {label}
          {required && <span className="text-critical"> *</span>}
        </label>
      )}
      <button
        ref={buttonRef}
        id={buttonId}
        type="button"
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        aria-label={ariaLabel}
        aria-activedescendant={open && active >= 0 ? `${listId}-${active}` : undefined}
        disabled={disabled}
        onClick={() => (open ? close() : openList())}
        onKeyDown={onKeyDown}
        className={clsx(
          'group flex w-full items-center gap-2 rounded-lg border bg-panel-2 text-left text-text transition-colors',
          'focus:outline-none focus-visible:border-info focus-visible:ring-2 focus-visible:ring-info/30',
          'disabled:cursor-not-allowed disabled:opacity-50',
          open ? 'border-info' : 'border-border hover:border-border-strong',
          SIZES[size],
          buttonClassName,
        )}
      >
        {selected?.icon && <span className="flex shrink-0">{selected.icon}</span>}
        <span className={clsx('min-w-0 flex-1 truncate', !selected && 'text-subtle')}>
          {selected?.label ?? placeholder ?? t('ui.select')}
        </span>
        <ChevronDown
          className={clsx('h-4 w-4 shrink-0 text-muted transition-transform', open && 'rotate-180 text-info')}
          aria-hidden
        />
      </button>

      {open &&
        pos &&
        createPortal(
          <div
            ref={listRef}
            className="fixed z-[2000] flex flex-col overflow-hidden rounded-xl border border-border-strong bg-panel shadow-[0_12px_32px_rgba(0,0,0,0.45)] animate-[popIn_120ms_ease-out]"
            style={{ left: pos.left, top: pos.top, bottom: pos.bottom, width: pos.width, maxHeight: pos.maxHeight }}
          >
            {canSearch && (
              <div className="flex items-center gap-2 border-b border-border px-3">
                <Search className="h-4 w-4 text-muted" aria-hidden />
                <input
                  autoFocus
                  value={query}
                  onChange={(e) => {
                    setQuery(e.target.value)
                    setActive(0)
                  }}
                  onKeyDown={onKeyDown}
                  placeholder={t('ui.search')}
                  aria-label={t('ui.search')}
                  className="h-10 w-full bg-transparent text-sm text-text placeholder:text-subtle focus:outline-none"
                />
              </div>
            )}
            <ul id={listId} role="listbox" aria-labelledby={buttonId} className="overflow-y-auto p-1.5">
              {visible.length === 0 && <li className="px-3 py-2.5 text-sm text-muted">{t('ui.noOptions')}</li>}
              {visible.map((o, i) => {
                const isSelected = String(o.value) === String(value ?? '')
                return (
                  <li
                    key={o.value}
                    id={`${listId}-${i}`}
                    data-index={i}
                    role="option"
                    aria-selected={isSelected}
                    aria-disabled={o.disabled || undefined}
                    onMouseEnter={() => setActive(i)}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => choose(o)}
                    className={clsx(
                      'flex cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm',
                      o.disabled && 'cursor-not-allowed opacity-40',
                      i === active && !o.disabled ? 'bg-panel-3' : '',
                      isSelected ? 'text-text font-semibold' : 'text-text/90',
                    )}
                  >
                    {o.icon && <span className="flex shrink-0">{o.icon}</span>}
                    <span className="min-w-0 flex-1">
                      <span className="block truncate">{o.label}</span>
                      {o.description && <span className="block truncate text-xs font-normal text-muted">{o.description}</span>}
                    </span>
                    {isSelected && <Check className="h-4 w-4 shrink-0 text-info" aria-hidden />}
                  </li>
                )
              })}
            </ul>
          </div>,
          document.body,
        )}
    </div>
  )
}
