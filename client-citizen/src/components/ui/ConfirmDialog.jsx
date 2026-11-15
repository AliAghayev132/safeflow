/* eslint-disable react-refresh/only-export-components */
import { createContext, useCallback, useContext, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { clsx } from 'clsx'
import { AlertTriangle, HelpCircle } from 'lucide-react'
import { Sheet } from './Sheet'
import { Button } from './Button'

/**
 * Promise-based confirmation — replaces window.confirm().
 *   const confirm = useConfirm()
 *   if (await confirm({ title, message, confirmLabel, tone: 'danger' })) …
 */
const ConfirmContext = createContext(null)

export const ConfirmProvider = ({ children }) => {
  const [dialog, setDialog] = useState(null)
  const resolver = useRef(null)

  const confirm = useCallback(
    (opts = {}) =>
      new Promise((resolve) => {
        resolver.current?.(false)
        resolver.current = resolve
        setDialog(opts)
      }),
    []
  )
  const settle = useCallback((result) => {
    resolver.current?.(result)
    resolver.current = null
    setDialog(null)
  }, [])

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      <ConfirmSheet dialog={dialog} onResult={settle} />
    </ConfirmContext.Provider>
  )
}

const ConfirmSheet = ({ dialog, onResult }) => {
  const { t } = useTranslation()
  const danger = dialog?.tone === 'danger'
  const close = useCallback(() => onResult(false), [onResult])
  return (
    <Sheet open={Boolean(dialog)} onClose={close} role="alertdialog" labelledBy="confirm-title">
      {dialog && (
        <div className="pt-4 text-center">
          <span
            className={clsx(
              'mx-auto flex h-16 w-16 items-center justify-center rounded-full',
              danger ? 'bg-sos-soft text-sos' : 'bg-brand-soft text-brand'
            )}
          >
            {danger ? <AlertTriangle className="h-7 w-7" aria-hidden /> : <HelpCircle className="h-7 w-7" aria-hidden />}
          </span>
          <h2 id="confirm-title" className="mt-4 text-lg font-extrabold tracking-tight text-ink">
            {dialog.title ?? t('ui.confirmTitle')}
          </h2>
          {dialog.message && <p className="mt-1.5 text-sm text-muted">{dialog.message}</p>}
          <div className="mt-6 grid gap-2">
            <Button variant={danger ? 'sos' : 'primary'} size="lg" fullWidth onClick={() => onResult(true)}>
              {dialog.confirmLabel ?? t('ui.confirm')}
            </Button>
            <Button variant="outline" size="lg" fullWidth data-autofocus onClick={close}>
              {dialog.cancelLabel ?? t('ui.cancel')}
            </Button>
          </div>
        </div>
      )}
    </Sheet>
  )
}

export const useConfirm = () => {
  const ctx = useContext(ConfirmContext)
  if (!ctx) throw new Error('useConfirm must be used inside <ConfirmProvider>')
  return ctx
}
