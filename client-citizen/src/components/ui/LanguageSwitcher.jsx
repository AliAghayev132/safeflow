import { useTranslation } from 'react-i18next'
import { clsx } from 'clsx'
import { LANGUAGES, setLanguage } from '@/i18n'

/** AZ / EN / RU segmented switcher; the choice is persisted. */
export const LanguageSwitcher = ({ className }) => {
  const { t, i18n } = useTranslation()
  return (
    <div
      role="radiogroup"
      aria-label={t('common.language')}
      className={clsx('flex rounded-xl border border-line-strong bg-surface p-0.5', className)}
    >
      {LANGUAGES.map((lng) => (
        <button
          key={lng}
          type="button"
          role="radio"
          aria-checked={i18n.language === lng}
          title={t(`lang.${lng}Name`)}
          onClick={() => setLanguage(lng)}
          className={clsx(
            'h-8 min-w-9 rounded-lg px-2 text-xs font-extrabold transition-colors',
            i18n.language === lng ? 'bg-brand text-white' : 'text-ink-soft hover:bg-canvas'
          )}
        >
          {t(`lang.${lng}`)}
        </button>
      ))}
    </div>
  )
}
