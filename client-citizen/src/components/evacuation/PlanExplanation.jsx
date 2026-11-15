import { useTranslation } from 'react-i18next'
import { Lightbulb } from 'lucide-react'
import { useFeature } from '@hooks'

/**
 * "Why this shelter?" — smart load balancing explains the recommendation,
 * e.g. "The nearest point is 88% full; this one is 4 min further, 40% full."
 * Translated by key; the server's Azerbaijani text is the fallback.
 */
export const PlanExplanation = ({ explanation }) => {
  const { t } = useTranslation()
  const enabled = useFeature('smartBalancing')
  if (!enabled || !explanation) return null

  return (
    <p role="note" className="flex items-start gap-2 rounded-xl bg-brand-soft px-3 py-2.5 text-sm font-medium text-brand">
      <Lightbulb className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
      <span>{t(explanation.key, { ...explanation.params, defaultValue: explanation.text })}</span>
    </p>
  )
}
