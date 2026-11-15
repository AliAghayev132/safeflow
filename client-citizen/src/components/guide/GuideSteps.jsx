import { useTranslation } from 'react-i18next'
import { clsx } from 'clsx'
import { Icon3D } from '@components/ui'
import { disasterTypes } from '@constants'

/** Disaster selector + high-visibility numbered survival steps. */
export const GuideSteps = ({ value, onChange, highlight }) => {
  const { t } = useTranslation()
  const steps = t(`guide.steps.${value}`, { returnObjects: true })

  return (
    <section>
      <div className="grid grid-cols-4 gap-2" role="tablist" aria-label={t('guide.title')}>
        {disasterTypes.map((d) => (
          <button
            key={d.value}
            type="button"
            role="tab"
            aria-selected={value === d.value}
            onClick={() => onChange(d.value)}
            className={clsx(
              'flex min-h-20 flex-col items-center justify-center gap-1 rounded-2xl border-2 px-1 text-xs font-extrabold transition-colors',
              value === d.value ? 'border-ink bg-ink text-white' : 'border-line-strong bg-surface text-ink hover:bg-canvas'
            )}
          >
            <Icon3D name={d.icon} size={30} />
            {t(`guide.disasters.${d.value}`)}
          </button>
        ))}
      </div>

      {highlight && (
        <p className="mt-3 rounded-lg bg-brand-soft px-3 py-2 text-xs font-bold text-brand">{t('guide.activeFor')}</p>
      )}

      <ol className="mt-3 space-y-2">
        {Array.isArray(steps) &&
          steps.map((step, i) => (
            <li key={i} className="flex gap-3 rounded-2xl border-2 border-ink bg-surface p-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-sos text-base font-extrabold text-white">
                {i + 1}
              </span>
              <span className="self-center text-base font-bold leading-snug text-ink">{step}</span>
            </li>
          ))}
      </ol>
    </section>
  )
}
