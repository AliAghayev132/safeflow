import { useTranslation } from 'react-i18next'
import { clsx } from 'clsx'
import { Spinner } from '@components/ui'

/**
 * The big round SOS button. Solid concentric rings (no gradients) that
 * slowly "breathe" (scale + opacity; still under prefers-reduced-motion).
 * One tap sends a general SOS immediately.
 */
export const SosButton = ({ onPress, sending, disabled }) => {
  const { t } = useTranslation()
  return (
    <div className="flex justify-center py-3">
      <div className="relative flex h-64 w-64 items-center justify-center">
        <span className="breathe absolute inset-0 rounded-full bg-sos-soft" aria-hidden />
        <span className="breathe-delayed absolute inset-[7%] rounded-full bg-[#fbd5da]" aria-hidden />
        <button
          type="button"
          onClick={onPress}
          disabled={disabled}
          aria-label={`${t('sos.button')} — ${t('sos.buttonHint')}`}
          className={clsx(
            'relative flex h-[72%] w-[72%] flex-col items-center justify-center rounded-full bg-sos text-white transition-transform duration-150',
            'hover:bg-sos-hover active:scale-[0.93]',
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
  )
}
