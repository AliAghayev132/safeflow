// React
import { Suspense } from 'react'

// React Router
import { Navigate, Route, Routes } from 'react-router'

// Redux
import { useSelector } from 'react-redux'
import { selectPermissions } from '@store/slices/authSlice'

// Layouts
import { DashboardLayout } from '@layouts'

// Components
import { ProtectedRoute, PageLoader } from '@components'

// Pages
import { NotFoundPage } from '@pages/public'

// Route config (permission-driven)
import { accessibleRoutes, routeUrl } from './routeConfig'

/**
 * Routes are generated from routeConfig for the user's permissions only —
 * a page the role may not open simply does not exist for that user.
 */
export const DashboardRouter = () => {
  const permissions = useSelector(selectPermissions)
  const routes = accessibleRoutes(permissions)
  const home = routes[0]

  return (
    <Routes>
      <Route
        element={
          <ProtectedRoute>
            <DashboardLayout />
          </ProtectedRoute>
        }
      >
        {routes.map(({ key, path, Component }) =>
          path === '' ? (
            <Route
              key={key}
              index
              element={
                <Suspense fallback={<PageLoader />}>
                  <Component />
                </Suspense>
              }
            />
          ) : (
            <Route
              key={key}
              path={path}
              element={
                <Suspense fallback={<PageLoader />}>
                  <Component />
                </Suspense>
              }
            />
          )
        )}
        {/* Index not permitted (e.g. role without dashboard:view) → first allowed page */}
        {home && home.path !== '' && <Route index element={<Navigate to={routeUrl(home)} replace />} />}
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  )
}
