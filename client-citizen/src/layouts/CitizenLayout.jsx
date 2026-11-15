import { NavLink, Outlet, Link, useLocation, matchPath } from 'react-router'
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
 * Always phone-sized shell: one centred column (max 440px, see #root in
 * App.css) on every screen. Clean white header, offline banner, and a
 * floating dark pill tab bar with a sliding active pill.
 */
export const CitizenLayout = () => {
  const { t } = useTranslation()
  const { pathname } = useLocation()
  const activeIndex = navItems.findIndex(({ to, end }) => matchPath({ path: to, end: Boolean(end) }, pathname))

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
        <div className="flex items-center gap-2 px-4 pb-2 pt-3">
          <Link to="/" className="flex min-w-0 flex-1 items-center gap-2.5 rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-surface">
              <Icon3D name="shield" size={26} />
            </span>
            <span className="min-w-0 leading-tight">
              <span className="block truncate text-lg font-extrabold tracking-tight text-ink">{t('common.appName')}</span>
              <span className="block truncate text-xs font-medium text-muted">{t('common.appTagline')}</span>
            </span>
          </Link>

          <div className="flex shrink-0 items-center gap-1.5">
            <ContrastToggle />
            <LanguageSwitcher />
          </div>
        </div>
        <div className="flex px-4 pb-2">
          <ConnectionPill />
        </div>
      </header>

      <OfflineBanner />
      <ModuleBanners />

      <main id="main" tabIndex={-1} className="w-full flex-1 px-4 pb-32 pt-1 focus:outline-none">
        <div key={pathname} className="page-enter">
          <Outlet />
        </div>
      </main>

      {/* Floating pill tab bar — always visible, constrained to the phone column */}
      <nav
        className="pb-safe fixed inset-x-0 bottom-0 z-[500] mx-auto max-w-[var(--app-width)] px-4 pb-4"
        aria-label={t('common.appName')}
      >
        <div className="relative grid h-16 grid-cols-4 items-center rounded-full bg-ink p-1.5 shadow-[0_10px_30px_rgba(13,15,20,0.28)]">
          {/* Sliding active pill (solid) */}
          <span
            aria-hidden
            className="nav-indicator pointer-events-none absolute inset-y-1.5 left-1.5 rounded-full bg-canvas"
            style={{
              width: 'calc((100% - 0.75rem) / 4)',
              transform: `translateX(${Math.max(activeIndex, 0) * 100}%)`,
              opacity: activeIndex === -1 ? 0 : 1,
            }}
          />
          {navItems.map(({ to, key, Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              aria-label={t(`nav.${key}`)}
              className={({ isActive }) =>
                clsx(
                  'relative z-10 flex h-full min-w-0 items-center justify-center gap-1.5 rounded-full px-2 text-xs font-bold transition-colors duration-300',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white active:scale-95',
                  isActive ? 'text-ink' : 'text-white/80 hover:text-white'
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
