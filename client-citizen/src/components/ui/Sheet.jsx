import { useEffect, useId, useRef } from 'react'
import { createPortal } from 'react-dom'
import { clsx } from 'clsx'

/**
 * Bottom sheet on phones, centred dialog from sm up. Portal, backdrop,
 * Esc closes, focus is trapped inside and returned to the opener.
 */
export const Sheet = ({ open, onClose, title, children, footer, role = 'dialog', labelledBy }) => {
  const panel = useRef(null)
  const autoId = useId()
  const titleId = labelledBy ?? autoId

  useEffect(() => {
    if (!open) return
    const opener = document.activeElement
    const focusables = () =>
      [...(panel.current?.querySelectorAll('button, [href], input, textarea, [tabindex]:not([tabindex="-1"])') ?? [])].filter(
        (el) => !el.disabled
      )
    ;(panel.current?.querySelector('[data-autofocus]') ?? focusables()[0])?.focus()

    const onKey = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        onClose()
      }
      if (e.key === 'Tab') {
        const items = focusables()
        if (!items.length) return
        const first = items[0]
        const last = items[items.length - 1]
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault()
          last.focus()
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault()
          first.focus()
        }
      }
    }
    document.addEventListener('keydown', onKey)
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = overflow
      opener?.focus?.()
    }
  }, [open, onClose])

  if (!open) return null
  return createPortal(
    <div className="fixed inset-0 z-[1200] flex items-end justify-center sm:items-center sm:p-4">
      <div className="absolute inset-0 bg-ink/50" onClick={onClose} aria-hidden />
      <div
        ref={panel}
        role={role}
        aria-modal="true"
        aria-labelledby={titleId}
        className={clsx(
          'pb-safe relative flex max-h-[85vh] w-full flex-col rounded-t-[28px] bg-canvas sm:max-w-md sm:rounded-[28px]',
          'animate-slide-up shadow-[0_-12px_40px_rgba(13,15,20,0.18)]'
        )}
      >
        <span className="mx-auto mt-2.5 h-1.5 w-10 rounded-full bg-surface-strong sm:hidden" aria-hidden />
        {title && (
          <h2 id={titleId} className="px-5 pb-2 pt-4 text-lg font-extrabold tracking-tight text-ink">
            {title}
          </h2>
        )}
        <div className="flex-1 overflow-y-auto px-5 pb-4">{children}</div>
        {footer && <div className="px-5 pb-5">{footer}</div>}
      </div>
    </div>,
    document.body
  )
}
