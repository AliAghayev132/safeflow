import { Link } from 'react-router'
import { useTranslation } from 'react-i18next'
import { ChevronRight } from 'lucide-react'

import { Icon3D } from '@components/ui'
import { useFeature } from '@hooks'

/** SOS-page entry point to the AI assistant (only while the flag is on). */
export const AssistantEntryCard = () => {
  const { t } = useTranslation()
  const enabled = useFeature('aiChatbot')
  if (!enabled) return null
  return (
    <Link
      to="/assistant"
      className="lift flex min-h-16 items-center gap-3 rounded-3xl bg-brand-soft p-4 hover:bg-[#d9e6ff] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
    >
      <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-canvas">
        <Icon3D name="megaphone" size={30} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-base font-extrabold text-ink">{t('assistant.entryTitle')}</span>
        <span className="block text-xs font-medium text-ink-soft">{t('assistant.entryDesc')}</span>
      </span>
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand text-white" aria-hidden>
        <ChevronRight className="h-5 w-5" />
      </span>
    </Link>
  )
}
