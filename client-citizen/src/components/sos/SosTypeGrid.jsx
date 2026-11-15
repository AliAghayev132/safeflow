import { useTranslation } from 'react-i18next'
import { clsx } from 'clsx'
import { ArrowUpRight } from 'lucide-react'
import { Icon3D, Spinner } from '@components/ui'
import { sosTypes } from '@constants'

/** One-tap typed SOS: each tile sends immediately. */
export const SosTypeGrid = ({ onSend, sendingType }) => {
  const { t } = useTranslation()
  return (
    <section aria-labelledby="sos-types-title">
      <div className="mb-3 flex items-end justify-between gap-3">
        <div>
          <h2 id="sos-types-title" className="text-lg font-extrabold tracking-tight text-ink">
            {t('sos.whatEmergency')}
          </h2>
          <p className="text-xs font-medium text-muted">{t('sos.typeHint')}</p>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        {sosTypes.map((type) => {
          const sending = sendingType === type.value
          return (
            <button
              key={type.value}
              type="button"
              disabled={Boolean(sendingType)}
              onClick={() => onSend(type.value)}
              className={clsx(
                'group relative flex min-h-32 flex-col justify-between rounded-3xl p-4 text-left transition-colors',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sos focus-visible:ring-offset-2',
                sending ? 'bg-sos text-white' : 'bg-surface text-ink hover:bg-surface-strong active:bg-sos-soft',
                sendingType && !sending && 'opacity-60'
              )}
            >
              <span className="flex w-full items-start justify-between">
                <span className="flex h-14 w-14 items-center justify-center rounded-full bg-canvas">
                  {sending ? <Spinner className="h-6 w-6 text-sos" /> : <Icon3D name={type.icon} size={34} />}
                </span>
                <span
                  className={clsx(
                    'flex h-9 w-9 items-center justify-center rounded-full transition-colors',
                    sending ? 'bg-white/20 text-white' : 'bg-canvas text-ink group-hover:bg-ink group-hover:text-white'
                  )}
                  aria-hidden
                >
                  <ArrowUpRight className="h-4 w-4" />
                </span>
              </span>
              <span className="mt-3 text-base font-extrabold leading-tight">{t(`sos.types.${type.value}`)}</span>
            </button>
          )
        })}
      </div>
    </section>
  )
}
