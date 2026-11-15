import { useTranslation } from 'react-i18next'
import { clsx } from 'clsx'
import { Icon3D, Spinner } from '@components/ui'
import { sosTypes } from '@constants'

/** One-tap typed SOS: each tile sends immediately. */
export const SosTypeGrid = ({ onSend, sendingType }) => {
  const { t } = useTranslation()
  return (
    <section aria-labelledby="sos-types-title">
      <h2 id="sos-types-title" className="text-base font-extrabold text-ink">
        {t('sos.whatEmergency')}
      </h2>
      <p className="mb-2 text-xs font-medium text-muted">{t('sos.typeHint')}</p>
      <div className="grid grid-cols-2 gap-2.5">
        {sosTypes.map((type) => {
          const sending = sendingType === type.value
          return (
            <button
              key={type.value}
              type="button"
              disabled={Boolean(sendingType)}
              onClick={() => onSend(type.value)}
              className={clsx(
                'flex min-h-16 items-center gap-3 rounded-2xl border-2 px-3 py-3 text-left transition-colors',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sos focus-visible:ring-offset-2',
                sending
                  ? 'border-sos bg-sos text-white'
                  : 'border-line-strong bg-surface text-ink hover:border-sos active:bg-sos-soft',
                sendingType && !sending && 'opacity-60'
              )}
            >
              <span
                className={clsx(
                  'flex h-12 w-12 shrink-0 items-center justify-center rounded-full',
                  sending ? 'bg-white' : 'bg-ink'
                )}
              >
                {sending ? <Spinner className="h-5 w-5 text-sos" /> : <Icon3D name={type.icon} size={28} />}
              </span>
              <span className="text-base font-extrabold leading-tight">{t(`sos.types.${type.value}`)}</span>
            </button>
          )
        })}
      </div>
    </section>
  )
}
