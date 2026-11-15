import { useTranslation } from 'react-i18next'
import { clsx } from 'clsx'
import { Languages } from 'lucide-react'
import { LANGUAGES } from '@/i18n'

/** AZ / EN / RU segmented switch (choice persisted by i18n). */
export const LanguageSwitcher = ({ className }) => {
  const { t, i18n } = useTranslation()
  return (
    <div
      role="group"
      aria-label={t('app.language')}
      className={clsx('inline-flex items-center gap-0.5 h-9 rounded-lg border border-border p-0.5', className)}
    >
      <Languages className="w-4 h-4 text-muted mx-1.5" aria-hidden />
      {LANGUAGES.map((lang) => {
        const active = i18n.language === lang.code
        return (
          <button
            key={lang.code}
            onClick={() => i18n.changeLanguage(lang.code)}
            aria-pressed={active}
            className={clsx(
              'h-7 px-2 rounded-md text-xs font-bold cursor-pointer',
              active ? 'bg-panel-3 text-text border border-border-strong' : 'text-muted hover:text-text'
            )}
          >
            {lang.label}
          </button>
        )
      })}
    </div>
  )
}
