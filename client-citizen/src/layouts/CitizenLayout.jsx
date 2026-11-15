import { NavLink, Outlet, Link } from 'react-router'
import { useTranslation } from 'react-i18next'
import { clsx } from 'clsx'
import { Siren, Navigation, BookOpen, UserRound } from 'lucide-react'

import { Icon3D, LanguageSwitcher } from '@components/ui'
import { OfflineBanner } from '@components/OfflineBanner'
import { ModuleBanners } from '@components/ModuleBanners'
import { ConnectionPill } from '@components/ConnectionPill'
import { ContrastToggle } from '@/modules/accessibility'

const navItems = [
  { to: '/', key: 'sos', Icon: Siren, end: true },
  { to: '/evacuation', key: 'evacuation', Icon: Navigation },
  { to: '/guide', key: 'guide', Icon: BookOpen },
  { to: '/profile', key: 'profile', Icon: UserRound },
]

/**
 * Mobile-first shell: clean white header (app name, live state, contrast,
 * language, profile), offline banner, and a floating dark pill tab bar on
 * phones (inline pill tabs from md and up).
 */
export const CitizenLayout = () => {
  const { t } = useTranslation()

  return (
    <div className="flex min-h-full flex-col bg-canvas">
      {/* WCAG 2.4.1 — bypass blocks */}
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[1000] focus:flex focus:min-h-12 focus:items-center focus:rounded-full focus:bg-ink focus:px-5 focus:text-sm focus:font-bold focus:text-white"
      >
        {t('a11y.skipToContent')}
      </a>

      <header className="sticky top-0 z-[500] bg-canvas">
        <div className="mx-auto flex max-w-6xl items-center gap-2 px-4 pb-2 pt-3">
          <Link to="/" className="flex min-w-0 flex-1 items-center gap-2.5 rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-surface">
              <Icon3D name="shield" size={26} />
            </span>
            <span className="min-w-0 leading-tight">
              <span className="block truncate text-lg font-extrabold tracking-tight text-ink">{t('common.appName')}</span>
              <span className="block truncate text-xs font-medium text-muted">{t('common.appTagline')}</span>
            </span>
          </Link>

          <nav className="mx-2 hidden items-center gap-1 rounded-full bg-surface p-1 md:flex" aria-label={t('common.appName')}>
            {navItems.map(({ to, key, Icon, end }) => (
              <NavLink
                key={to}
                to={to}
                end={end}
                className={({ isActive }) =>
                  clsx(
                    'flex h-10 items-center gap-2 rounded-full px-4 text-sm font-semibold transition-colors',
                    isActive ? 'bg-ink text-white' : 'text-ink-soft hover:bg-surface-strong'
                  )
                }
              >
                <Icon className="h-4 w-4" aria-hidden />
                {t(`nav.${key}`)}
              </NavLink>
            ))}
          </nav>

          <div className="flex shrink-0 items-center gap-1.5">
            <ContrastToggle />
            <LanguageSwitcher />
          </div>
        </div>
        <div className="mx-auto flex max-w-6xl px-4 pb-2">
          <ConnectionPill />
        </div>
      </header>

      <OfflineBanner />
      <ModuleBanners />

      <main id="main" tabIndex={-1} className="mx-auto w-full max-w-6xl flex-1 px-4 pb-32 pt-1 focus:outline-none md:pb-10">
        <Outlet />
      </main>

      {/* Floating pill tab bar (phones) */}
      <nav className="pb-safe fixed inset-x-0 bottom-0 z-[500] px-4 pb-4 md:hidden" aria-label={t('common.appName')}>
        <div className="mx-auto flex h-16 max-w-md items-center justify-between gap-1 rounded-full bg-ink p-1.5 shadow-[0_10px_30px_rgba(13,15,20,0.28)]">
          {navItems.map(({ to, key, Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              aria-label={t(`nav.${key}`)}
              className={({ isActive }) =>
                clsx(
                  'flex h-full min-w-12 items-center justify-center gap-2 rounded-full text-sm font-bold transition-all',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white',
                  isActive ? 'flex-[1.6] bg-canvas px-4 text-ink' : 'flex-1 text-white/80 hover:text-white'
                )
              }
            >
              {({ isActive }) => (
                <>
                  <Icon className={clsx('h-5 w-5 shrink-0', isActive && key === 'sos' && 'text-sos')} aria-hidden />
                  {isActive && <span className="truncate">{t(`nav.${key}`)}</span>}
                </>
              )}
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  )
}
