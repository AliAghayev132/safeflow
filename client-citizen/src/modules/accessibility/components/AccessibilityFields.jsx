import { useTranslation } from 'react-i18next'
import { ACCESSIBILITY_FLAGS } from '../flags'

/**
 * "I can't speak / I can't hear / I have limited mobility …" — sent with the
 * profile; the server attaches it to every SOS and raises the priority.
 */
export const AccessibilityFields = ({ value, onChange }) => {
  const { t } = useTranslation()
  return (
    <fieldset className="space-y-2">
      <legend className="text-base font-bold text-ink">{t('a11y.profile.title')}</legend>
      <p className="text-xs font-medium text-muted">{t('a11y.profile.intro')}</p>
      {ACCESSIBILITY_FLAGS.map((flag) => (
        <div key={flag} className="flex min-h-12 items-center gap-3 rounded-xl border-2 border-line-strong px-3">
          <input
            id={`a11y-${flag}`}
            type="checkbox"
            checked={Boolean(value?.[flag])}
            onChange={(e) => onChange({ ...value, [flag]: e.target.checked })}
            className="h-6 w-6 shrink-0 accent-[var(--color-brand)]"
          />
          <label htmlFor={`a11y-${flag}`} className="flex min-h-12 flex-1 cursor-pointer items-center text-sm font-bold text-ink">
            {t(`a11y.profile.${flag}`)}
          </label>
        </div>
      ))}
    </fieldset>
  )
}
