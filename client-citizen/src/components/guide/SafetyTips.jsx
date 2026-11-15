import { useTranslation } from 'react-i18next'
import { Info } from 'lucide-react'

export const SafetyTips = () => {
  const { t } = useTranslation()
  const tips = t('guide.tips', { returnObjects: true })
  return (
    <section className="rounded-3xl border border-line bg-surface p-4">
      <h2 className="text-base font-extrabold text-ink">{t('guide.tipsTitle')}</h2>
      <ul className="mt-2 space-y-2">
        {Array.isArray(tips) &&
          tips.map((tip, i) => (
            <li key={i} className="flex gap-2 text-sm font-medium text-ink-soft">
              <Info className="mt-0.5 h-4 w-4 shrink-0 text-info" aria-hidden />
              {tip}
            </li>
          ))}
      </ul>
    </section>
  )
}
