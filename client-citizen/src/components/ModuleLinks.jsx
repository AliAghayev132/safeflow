import { Link } from 'react-router'
import { useTranslation } from 'react-i18next'
import { ChevronRight } from 'lucide-react'

import { Icon3D } from '@components/ui'
import { useFeatures } from '@hooks'

/**
 * Entry slot for feature-module pages. Any route in routes/modules/*.js with
 * `menu: { icon, labelKey, descKey }` shows up here (Profile page) while its
 * feature flag is on — modules never edit the pages that host the links.
 */
const moduleFiles = import.meta.glob('../routes/modules/*.js', { eager: true })
const LINKS = Object.values(moduleFiles)
  .flatMap((m) => m.routes ?? [])
  .filter((r) => r.menu)

export const ModuleLinks = () => {
  const { t } = useTranslation()
  const features = useFeatures()
  const links = LINKS.filter((r) => !r.feature || features[r.feature] === true)
  if (!links.length) return null

  return (
    <nav aria-label={t('profile.moreServices', { defaultValue: '' })} className="space-y-2">
      {links.map((r) => (
        <Link
          key={r.path}
          to={`/${r.path}`}
          className="flex min-h-14 items-center gap-3 rounded-3xl bg-surface p-3 hover:bg-surface-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
        >
          <Icon3D name={r.menu.icon} size={36} />
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-bold text-ink">{t(r.menu.labelKey)}</span>
            {r.menu.descKey && <span className="block text-xs text-muted">{t(r.menu.descKey)}</span>}
          </span>
          <ChevronRight className="h-5 w-5 text-muted" aria-hidden />
        </Link>
      ))}
    </nav>
  )
}
