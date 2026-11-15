// React Router
import { Route, Routes } from 'react-router'

// Layouts
import { CitizenLayout } from '@layouts'

// Pages
import { SosPage, EvacuationPage, SheltersPage, GuidePage, ProfilePage, NotFoundPage } from '@pages/main'
import { SafeStatusPage } from '@pages/public'

/** "/" is always the SOS screen — no login, no intermediate steps. */
export const CitizenRouter = () => (
  <Routes>
    <Route path="safe/:token" element={<SafeStatusPage />} />
    <Route element={<CitizenLayout />}>
      <Route index element={<SosPage />} />
      <Route path="evacuation" element={<EvacuationPage />} />
      <Route path="shelters" element={<SheltersPage />} />
      <Route path="guide" element={<GuidePage />} />
      <Route path="profile" element={<ProfilePage />} />
      <Route path="*" element={<NotFoundPage />} />
    </Route>
  </Routes>
)
