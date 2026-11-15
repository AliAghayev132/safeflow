// React Router
import { Route, Routes } from 'react-router'

// Layouts
import { CitizenLayout } from '@layouts'

// Pages
import { SosPage, EvacuationPage, SheltersPage, GuidePage, ProfilePage, NotFoundPage } from '@pages/main'
import { SafeStatusPage } from '@pages/public'

// Feature flags
import { useFeatures } from '@hooks'

/**
 * Feature-module routes: each routes/modules/*.js exports
 * `routes: [{ path, Component, feature, public? }]`. `public` routes render
 * outside the app shell (e.g. a full-screen page opened from a shortcut).
 * Modules never edit this file.
 */
const moduleFiles = import.meta.glob('./modules/*.js', { eager: true })
const MODULE_ROUTES = Object.values(moduleFiles).flatMap((m) => m.routes ?? [])

/** "/" is always the SOS screen — no login, no intermediate steps. */
export const CitizenRouter = () => {
  const features = useFeatures()
  const enabled = MODULE_ROUTES.filter((r) => !r.feature || features[r.feature] === true)

  return (
    <Routes>
      <Route path="safe/:token" element={<SafeStatusPage />} />
      {enabled
        .filter((r) => r.public)
        .map(({ path, Component }) => (
          <Route key={path} path={path} element={<Component />} />
        ))}
      <Route element={<CitizenLayout />}>
        <Route index element={<SosPage />} />
        <Route path="evacuation" element={<EvacuationPage />} />
        <Route path="shelters" element={<SheltersPage />} />
        <Route path="guide" element={<GuidePage />} />
        <Route path="profile" element={<ProfilePage />} />
        {enabled
          .filter((r) => !r.public)
          .map(({ path, Component }) => (
            <Route key={path} path={path} element={<Component />} />
          ))}
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  )
}
