// React Router
import { NavLink, Outlet, useLocation } from 'react-router'

// Redux
import { useDispatch, useSelector } from 'react-redux'

// i18n
import { useTranslation } from 'react-i18next'

// Icons
import { LogOut, Volume2, VolumeX, RefreshCw } from 'lucide-react'

// Store
import { logout, selectPermissions } from '@store/slices/authSlice'
import { muteToggled } from '@store/slices/uiSlice'
import { selectActiveAlerts, selectTriageQueue } from '@store/slices/liveSlice'
import { baseApi } from '@store/api'
import { useLiveData } from '@store/hooks'

// Components
import {
  Icon3D,
  PageLoader,
  Toaster,
  AlertBanner,
  Button,
  EmptyState,
  LanguageSwitcher,
  StatusBadge,
} from '@components'

// Route config (single source for menu + routes)
import { accessibleRoutes, routeUrl, SECTIONS } from '@routes/routeConfig'

// Hooks / utils / constants
import { useNow, useFeatures } from '@hooks'
import { formatTime } from '@utils'
import { CONNECTION_MODES } from '@constants'

const LiveClock = () => {
  const now = useNow(1000)
  return <span className="font-mono text-sm text-text tabular-nums">{formatTime(now)}</span>
}

/** Realtime transport mode: icon + text + colour (never colour alone). */
const ConnectionIndicator = () => {
  const { t } = useTranslation()
  const mode = useSelector((state) => state.ui.connection)
  return (
    <span title={t(`connection.${mode}Hint`)}>
      <StatusBadge meta={CONNECTION_MODES[mode]} label={t(`connection.${mode}`)} spin={mode === 'connecting'} />
    </span>
  )
}

/**
 * Operations-centre shell: permission-driven sidebar, status header
 * (connection mode, clock, language, alarm) and the critical alert banner.
 */
export const DashboardLayout = () => {
  const dispatch = useDispatch()
  const location = useLocation()
  const { t } = useTranslation()
  const operator = useSelector((state) => state.auth.operator)
  const role = useSelector((state) => state.auth.role)
  const permissions = useSelector(selectPermissions)
  const muted = useSelector((state) => state.ui.muted)
  const activeAlerts = useSelector(selectActiveAlerts)
  const queue = useSelector(selectTriageQueue)
  const { hydrated, isError, refetch } = useLiveData()

  const features = useFeatures()
  const routes = accessibleRoutes(permissions, features)
  const badges = {
    alerts: activeAlerts.length,
    queue: queue.filter((s) => s.status === 'pending' && !s.spamFlagged).length,
  }
  const active = routes.find((r) =>
    r.path === '' ? location.pathname === '/' : location.pathname.startsWith(routeUrl(r))
  )

  const handleLogout = () => {
    dispatch(logout())
    dispatch(baseApi.util.resetApiState())
  }

  return (
    <div className="h-screen flex bg-bg text-text overflow-hidden">
      {/* Sidebar */}
      <aside className="w-64 shrink-0 bg-panel border-r border-border flex flex-col max-lg:w-20">
        <div className="h-16 flex items-center gap-3 px-4 border-b border-border">
          <Icon3D name="shield" size={34} />
          <div className="max-lg:hidden leading-tight">
            <p className="text-sm font-bold tracking-wide">{t('app.title')}</p>
            <p className="text-[11px] text-muted">{t('app.subtitle')}</p>
          </div>
        </div>

        <nav className="flex-1 p-3 overflow-y-auto">
          {SECTIONS.map((section) => {
            const items = routes.filter((r) => r.section === section)
            if (!items.length) return null
            return (
              <div key={section} className="mb-3">
                <p className="px-3 pb-1.5 text-[10px] font-semibold uppercase tracking-wider text-subtle max-lg:hidden">
                  {t(`nav.section${section}`)}
                </p>
                <div className="space-y-1">
                  {items.map((item) => {
                    const count = item.badge ? badges[item.badge] : 0
                    return (
                      <NavLink
                        key={item.key}
                        to={routeUrl(item)}
                        end={item.path === ''}
                        title={t(`nav.${item.key}`)}
                        className={({ isActive }) =>
                          `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                            isActive
                              ? 'bg-panel-3 text-text border border-border-strong'
                              : 'text-muted hover:text-text hover:bg-panel-2 border border-transparent'
                          }`
                        }
                      >
                        <Icon3D name={item.icon} size={26} />
                        <span className="flex-1 max-lg:hidden">{t(`nav.${item.key}`)}</span>
                        {count > 0 && (
                          <span
                            className={`min-w-6 h-6 px-1.5 rounded-md text-xs font-bold flex items-center justify-center max-lg:hidden ${
                              item.badge === 'alerts' ? 'bg-critical text-white' : 'bg-warning text-bg'
                            }`}
                          >
                            {count}
                          </span>
                        )}
                      </NavLink>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </nav>

        <div className="p-3 border-t border-border">
          <div className="flex items-center gap-3 px-2 py-2 max-lg:justify-center">
            <div className="w-9 h-9 rounded-lg bg-info text-white text-sm font-bold flex items-center justify-center shrink-0">
              {operator?.fullName?.[0] ?? '·'}
            </div>
            <div className="min-w-0 flex-1 max-lg:hidden">
              <p className="text-sm font-medium truncate">{operator?.fullName}</p>
              <p className="text-xs text-muted truncate">
                @{operator?.username} · {t(`role.${role}`, { defaultValue: role })}
              </p>
            </div>
            <button
              onClick={handleLogout}
              className="text-muted hover:text-critical cursor-pointer max-lg:hidden"
              title={t('app.logout')}
              aria-label={t('app.logout')}
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0">
        <AlertBanner />

        <header className="h-16 shrink-0 bg-panel border-b border-border flex items-center gap-4 px-5">
          <h1 className="text-base font-semibold truncate">
            {active ? t(`nav.${active.key}`) : t('app.subtitle')}
          </h1>

          <div className="ml-auto flex items-center gap-3">
            {activeAlerts.length > 0 && (
              <span className="hidden xl:inline-flex items-center gap-2 h-8 px-3 rounded-lg bg-critical text-white text-xs font-bold">
                <span className="w-2 h-2 rounded-full bg-white blink" />
                {t('app.activeAlerts', { count: activeAlerts.length })}
              </span>
            )}

            <ConnectionIndicator />
            <LiveClock />
            <LanguageSwitcher className="max-md:hidden" />

            <button
              onClick={() => dispatch(muteToggled())}
              className="w-9 h-9 rounded-lg border border-border flex items-center justify-center text-muted hover:text-text hover:bg-panel-2 cursor-pointer"
              title={muted ? t('app.muteOn') : t('app.muteOff')}
              aria-label={muted ? t('app.muteOn') : t('app.muteOff')}
            >
              {muted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
            </button>
          </div>
        </header>

        <main className="flex-1 min-h-0 overflow-auto">
          {hydrated ? (
            <Outlet />
          ) : isError ? (
            <div className="h-full flex flex-col items-center justify-center">
              <EmptyState icon="antenna" title={t('app.loadFailed')} description={t('app.loadFailedHint')} />
              <Button variant="secondary" onClick={refetch} leftIcon={<RefreshCw className="w-4 h-4" />}>
                {t('app.retry')}
              </Button>
            </div>
          ) : (
            <PageLoader label={t('app.loadingLive')} />
          )}
        </main>
      </div>

      <Toaster />
    </div>
  )
}
