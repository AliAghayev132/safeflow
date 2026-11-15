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
    <div className="flex justify-center py-3">
      <div className="flex h-64 w-64 items-center justify-center rounded-full bg-sos-soft sm:h-72 sm:w-72">
        <div className="flex h-[86%] w-[86%] items-center justify-center rounded-full bg-[#fbd5da]">
          <button
            type="button"
            onClick={onPress}
            disabled={disabled}
            aria-label={`${t('sos.button')} — ${t('sos.buttonHint')}`}
            className={clsx(
              'flex h-[84%] w-[84%] flex-col items-center justify-center rounded-full bg-sos text-white transition-transform',
              'active:scale-95 hover:bg-sos-hover',
              'focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-sos focus-visible:ring-offset-4',
              'disabled:cursor-not-allowed disabled:opacity-80'
            )}
          >
            {sending ? (
              <Spinner className="h-12 w-12 border-4" />
            ) : (
              <span className="text-6xl font-extrabold tracking-wide">{t('sos.button')}</span>
            )}
            <span className="mt-1 px-5 text-center text-xs font-semibold text-white/90">
              {sending ? t('sos.sending') : t('sos.buttonHint')}
            </span>
          </button>
        </div>
      </div>
    </div>
  )
}
