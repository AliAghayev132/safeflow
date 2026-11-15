import { useEffect, useId, useRef } from 'react'
import { createPortal } from 'react-dom'
import { clsx } from 'clsx'
import { X } from 'lucide-react'
import { useTranslation } from 'react-i18next'

/**
 * Accessible modal dialog: portal, backdrop, Esc to close, focus trapped
 * inside and returned to the opener on close.
 *
 *   <Modal open onClose={…} title="…" subtitle="…" icon={…} footer={…}>body</Modal>
 */
export const Modal = ({ open, onClose, title, subtitle, icon, footer, children, size = 'md', className }) => {
  const { t } = useTranslation()
  const panel = useRef(null)
  const titleId = useId()
  const opener = useRef(null)

  useEffect(() => {
    if (!open) return
    opener.current = document.activeElement
    const focusables = () =>
      panel.current?.querySelectorAll('button, [href], input, textarea, select, [tabindex]:not([tabindex="-1"])') ?? []
    // First field (or the close button) gets focus
    const first = [...focusables()].find((el) => el.tagName !== 'BUTTON') ?? focusables()[0]
    first?.focus()

    const onKey = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        onClose()
      }
      if (e.key === 'Tab') {
        const items = [...focusables()].filter((el) => !el.disabled)
        if (!items.length) return
        const a = items[0]
        const z = items[items.length - 1]
        if (e.shiftKey && document.activeElement === a) {
          e.preventDefault()
          z.focus()
        } else if (!e.shiftKey && document.activeElement === z) {
          e.preventDefault()
          a.focus()
        }
      }
    }
    document.addEventListener('keydown', onKey)
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prevOverflow
      opener.current?.focus?.()
    }
  }, [open, onClose])

  if (!open) return null
  return createPortal(
    <div className="fixed inset-0 z-[2500] flex items-end justify-center sm:items-center sm:p-4">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} aria-hidden />
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={clsx(
          'relative flex max-h-[92vh] w-full flex-col overflow-hidden rounded-t-2xl border border-border-strong bg-panel shadow-[0_24px_64px_rgba(0,0,0,0.5)] sm:rounded-2xl animate-[popIn_140ms_ease-out]',
          { sm: 'sm:max-w-md', md: 'sm:max-w-xl', lg: 'sm:max-w-3xl' }[size],
          className
        )}
      >
        <header className="flex items-start gap-3 border-b border-border px-5 py-4">
          {icon && <span className="shrink-0">{icon}</span>}
          <div className="min-w-0 flex-1">
            <h2 id={titleId} className="truncate text-base font-bold text-text">
              {title}
            </h2>
            {subtitle && <div className="mt-0.5 text-xs text-muted">{subtitle}</div>}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={t('ui.close')}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-muted hover:bg-panel-2 hover:text-text focus:outline-none focus-visible:ring-2 focus-visible:ring-info cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </header>
        <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>
        {footer && <footer className="border-t border-border bg-panel-2/60 px-5 py-3">{footer}</footer>}
      </div>
    </div>,
    document.body
  )
}
