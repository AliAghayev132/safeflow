import { NavLink, Outlet } from 'react-router'
import { useTranslation } from 'react-i18next'
import { clsx } from 'clsx'

import { Icon3D, LanguageSwitcher } from '@components/ui'
import { OfflineBanner } from '@components/OfflineBanner'
import { ConnectionPill } from '@components/ConnectionPill'

const navItems = [
  { to: '/', key: 'sos', icon: 'sos', end: true },
  { to: '/evacuation', key: 'evacuation', icon: 'compass' },
  { to: '/guide', key: 'guide', icon: 'megaphone' },
  { to: '/profile', key: 'profile', icon: 'people' },
]

/**
 * Mobile-first shell: sticky header (brand, realtime state, language),
 * offline banner, thumb-reachable bottom tab bar on phones, inline tabs
 * from md and up.
 */
export const CitizenLayout = () => {
  const { t } = useTranslation()

  return (
    <div className="flex min-h-full flex-col">
      <header className="sticky top-0 z-[500] border-b border-line bg-surface">
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-2 px-3 sm:px-4">
          <Icon3D name="shield" size={30} />
          <div className="hidden min-w-0 leading-tight sm:block">
            <p className="truncate text-sm font-extrabold text-ink">{t('common.appName')}</p>
            <p className="truncate text-[11px] font-medium text-muted">{t('common.appTagline')}</p>
          </div>

          <nav className="ml-4 hidden items-center gap-1 md:flex" aria-label={t('common.appName')}>
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  clsx(
                    'flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold transition-colors',
                    isActive ? 'bg-brand text-white' : 'text-ink-soft hover:bg-canvas'
                  )
                }
              >
                <Icon3D name={item.icon} size={20} />
                {t(`nav.${item.key}`)}
              </NavLink>
            ))}
          </nav>

          <div className="ml-auto flex items-center gap-2">
            <ConnectionPill />
            <LanguageSwitcher />
          </div>
        </div>
      </header>

      <OfflineBanner />

      <main className="mx-auto w-full max-w-6xl flex-1 px-3 pb-28 pt-3 sm:px-4 md:pb-8">
        <Outlet />
      </main>

      <nav
        className="pb-safe fixed inset-x-0 bottom-0 z-[500] border-t border-line bg-surface md:hidden"
        aria-label={t('common.appName')}
      >
        <div className="mx-auto grid h-[4.25rem] max-w-md grid-cols-4">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                clsx(
                  'flex flex-col items-center justify-center gap-0.5 text-[11px] font-bold transition-colors',
                  isActive ? 'text-sos' : 'text-muted'
                )
              }
            >
              {({ isActive }) => (
                <>
                  <span className={clsx('flex h-9 w-14 items-center justify-center rounded-full', isActive && 'bg-sos-soft')}>
                    <Icon3D name={item.icon} size={26} />
                  </span>
                  {t(`nav.${item.key}`)}
                </>
              )}
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  )
}
