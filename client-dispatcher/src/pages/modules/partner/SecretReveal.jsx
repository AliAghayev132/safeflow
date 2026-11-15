import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Copy, Check, X, KeyRound } from 'lucide-react'
import { Button } from '@components'

/**
 * One-time display of a credential (client secret / webhook signing secret).
 * The server never returns it again.
 */
export const SecretReveal = ({ title, rows, onClose }) => {
  const { t } = useTranslation()
  const [copied, setCopied] = useState(null)

  const copy = async (label, value) => {
    try {
      await navigator.clipboard.writeText(value)
      setCopied(label)
    } catch {
      setCopied(null)
    }
  }

  return (
    <div role="alert" className="rounded-xl border border-warning bg-warning-soft p-4">
      <div className="flex items-start gap-3">
        <KeyRound className="w-5 h-5 text-warning shrink-0 mt-0.5" aria-hidden />
        <div className="min-w-0 flex-1 space-y-2">
          <p className="text-sm font-semibold text-text">{title}</p>
          <p className="text-xs text-warning">{t('partners.secretOnce')}</p>
          {rows.map(({ label, value }) => (
            <div key={label} className="flex items-center gap-2">
              <span className="w-28 shrink-0 text-xs text-muted">{label}</span>
              <code className="min-w-0 flex-1 truncate rounded bg-panel-2 px-2 py-1 font-mono text-xs text-text">{value}</code>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => copy(label, value)}
                leftIcon={copied === label ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              >
                {copied === label ? t('partners.copied') : t('partners.copy')}
              </Button>
            </div>
          ))}
        </div>
        <button type="button" onClick={onClose} className="text-muted hover:text-text cursor-pointer" aria-label={t('app.close')}>
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  )
}
