import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { clsx } from 'clsx'
import { AlertTriangle, HelpCircle, ShieldAlert } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button } from './Button'

/**
 * Promise-based confirmation dialog — replaces window.confirm().
 *
 *   const confirm = useConfirm()
 *   if (!(await confirm({ title, message, confirmLabel, tone: 'critical' }))) return
 *
 * Focus is trapped inside, Esc / backdrop cancel, Enter confirms, focus is
 * returned to the element that opened it.
 */
const ConfirmContext = createContext(null)

const TONES = {
  critical: { icon: ShieldAlert, box: 'bg-critical-soft text-critical', button: 'critical' },
  warning: { icon: AlertTriangle, box: 'bg-warning-soft text-warning', button: 'warning' },
  info: { icon: HelpCircle, box: 'bg-info-soft text-info', button: 'primary' },
}

export const ConfirmProvider = ({ children }) => {
  const [dialog, setDialog] = useState(null)
  const resolver = useRef(null)

  const confirm = useCallback(
    (opts = {}) =>
      new Promise((resolve) => {
        resolver.current?.(false)
        resolver.current = resolve
        setDialog({ ...opts, returnFocus: document.activeElement })
      }),
    [],
  )

  const settle = (result) => {
    resolver.current?.(result)
    resolver.current = null
    const back = dialog?.returnFocus
    setDialog(null)
    if (back?.focus) setTimeout(() => back.focus(), 0)
  }

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      {dialog && <ConfirmModal {...dialog} onResult={settle} />}
    </ConfirmContext.Provider>
  )
}

const ConfirmModal = ({ title, message, confirmLabel, cancelLabel, tone = 'info', onResult }) => {
  const { t } = useTranslation()
  const panel = useRef(null)
  const confirmBtn = useRef(null)
  const toneCfg = TONES[tone] ?? TONES.info
  const Icon = toneCfg.icon

  useEffect(() => {
    // Destructive actions start on Cancel, others on Confirm
    const first = tone === 'critical' ? panel.current?.querySelector('[data-cancel]') : confirmBtn.current
    first?.focus()
    const onKey = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        onResult(false)
      }
      if (e.key === 'Tab') {
        const items = panel.current?.querySelectorAll('button')
        if (!items?.length) return
        const firstEl = items[0]
        const last = items[items.length - 1]
        if (e.shiftKey && document.activeElement === firstEl) {
          e.preventDefault()
          last.focus()
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault()
          firstEl.focus()
        }
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onResult, tone])

  return createPortal(
    <div className="fixed inset-0 z-[3000] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60" onClick={() => onResult(false)} aria-hidden />
      <div
        ref={panel}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-title"
        aria-describedby={message ? 'confirm-message' : undefined}
        className="relative w-full max-w-md rounded-2xl border border-border-strong bg-panel p-6 shadow-[0_24px_64px_rgba(0,0,0,0.5)] animate-[popIn_140ms_ease-out]"
      >
        <div className="flex items-start gap-4">
          <span className={clsx('flex h-11 w-11 shrink-0 items-center justify-center rounded-xl', toneCfg.box)}>
            <Icon className="h-5 w-5" aria-hidden />
          </span>
          <div className="min-w-0 pt-0.5">
            <h2 id="confirm-title" className="text-base font-bold text-text">
              {title ?? t('ui.confirmTitle')}
            </h2>
            {message && (
              <p id="confirm-message" className="mt-1.5 text-sm leading-relaxed text-muted">
                {message}
              </p>
            )}
          </div>
        </div>
        <div className="mt-6 flex justify-end gap-2">
          <Button variant="secondary" data-cancel onClick={() => onResult(false)}>
            {cancelLabel ?? t('ui.cancel')}
          </Button>
          <Button ref={confirmBtn} variant={toneCfg.button} onClick={() => onResult(true)}>
            {confirmLabel ?? t('ui.confirm')}
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export const useConfirm = () => {
  const ctx = useContext(ConfirmContext)
  if (!ctx) throw new Error('useConfirm must be used inside <ConfirmProvider>')
  return ctx
}
