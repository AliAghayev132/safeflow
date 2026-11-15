import { useTranslation } from 'react-i18next'
import { clsx } from 'clsx'
import { Spinner } from '@components/ui'

/**
 * The big round SOS button. Solid concentric rings (no gradients).
 * One tap sends a general SOS immediately.
 */
export const SosButton = ({ onPress, sending, disabled }) => {
  const { t } = useTranslation()
  return (
    <div className="flex justify-center py-2">
      <div className="flex h-64 w-64 items-center justify-center rounded-full bg-[#f1f2f5] sm:h-72 sm:w-72">
        <div className="flex h-[88%] w-[88%] items-center justify-center rounded-full border border-line bg-surface">
          <button
            type="button"
            onClick={onPress}
            disabled={disabled}
            aria-label={`${t('sos.button')} — ${t('sos.buttonHint')}`}
            className={clsx(
              'flex h-[82%] w-[82%] flex-col items-center justify-center rounded-full text-white transition-transform',
              'border-[6px] border-[#f6c3cc] bg-sos active:scale-95 hover:bg-sos-hover',
              'focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-sos focus-visible:ring-offset-4',
              'disabled:cursor-not-allowed disabled:opacity-80'
            )}
          >
            {sending ? (
              <Spinner className="h-12 w-12 border-4" />
            ) : (
              <span className="text-6xl font-extrabold tracking-wide">{t('sos.button')}</span>
            )}
            <span className="mt-1 px-4 text-center text-xs font-semibold text-white/90">
              {sending ? t('sos.sending') : t('sos.buttonHint')}
            </span>
          </button>
        </div>
      </div>
    </div>
  )
}
