import { useEffect } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { useTranslation } from 'react-i18next'
import { clsx } from 'clsx'
import { X } from 'lucide-react'
import { toastDismissed } from '@store/slices/uiSlice'
import { Icon3D } from './Icon3D'

const STYLES = {
  success: { icon: 'safe', border: 'border-success' },
  error: { icon: 'cross', border: 'border-critical' },
  info: { icon: 'bell', border: 'border-info' },
}

const ToastItem = ({ toast }) => {
  const dispatch = useDispatch()
  const { t, i18n } = useTranslation()
  useEffect(() => {
    const id = setTimeout(() => dispatch(toastDismissed(toast.id)), 4500)
    return () => clearTimeout(id)
  }, [dispatch, toast.id])

  const style = STYLES[toast.type] ?? STYLES.info
  // `message` is a translation key, or an already translated error string
  const text = i18n.exists(toast.message) ? t(toast.message, toast.params) : toast.message
  return (
    <div
      role="status"
      className={clsx(
        'flex items-start gap-3 w-80 bg-panel-2 border-l-4 border border-border rounded-lg px-3 py-2.5',
        style.border
      )}
    >
      <Icon3D name={style.icon} size={22} />
      <p className="flex-1 text-sm text-text">{text}</p>
      <button
        onClick={() => dispatch(toastDismissed(toast.id))}
        className="text-muted hover:text-text cursor-pointer"
        aria-label={t('app.close')}
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  )
}

export const Toaster = () => {
  const toasts = useSelector((state) => state.ui.toasts)
  return (
    <div className="fixed bottom-4 right-4 z-[2000] flex flex-col gap-2">
      {toasts.map((t) => (
        <ToastItem key={t.id} toast={t} />
      ))}
    </div>
  )
}
