// React
import { lazy, Suspense } from 'react'

// React Router
import { Route, Routes, BrowserRouter } from 'react-router'

// Components
import { PageLoader } from '@components/ui'

// The citizen router is lazy so the map bundle ships in its own chunk.
const CitizenRouter = lazy(() =>
  import('./CitizenRouter').then((m) => ({ default: m.CitizenRouter }))
)

export const AppRouter = () => (
  <BrowserRouter>
    <Suspense fallback={<PageLoader />}>
      <Routes>
        <Route path="/*" element={<CitizenRouter />} />
      </Routes>
    </Suspense>
  </BrowserRouter>
)
