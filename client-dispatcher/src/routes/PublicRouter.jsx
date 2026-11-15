// React Router
import { Route, Routes } from 'react-router'

// Components
import { PublicOnlyRoute } from '@components'

// Pages
import { LoginPage } from '@pages/public'

export const PublicRouter = () => (
  <Routes>
    <Route
      index
      element={
        <PublicOnlyRoute>
          <LoginPage />
        </PublicOnlyRoute>
      }
    />
  </Routes>
)
