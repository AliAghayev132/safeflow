import { Navigate, useLocation } from 'react-router'
import { useSelector } from 'react-redux'
import { selectIsAuthenticated } from '@store/slices/authSlice'

/** Redirects to /login when there is no operator session. */
export const ProtectedRoute = ({ children }) => {
  const isAuthenticated = useSelector(selectIsAuthenticated)
  const location = useLocation()
  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />
  }
  return children
}

/** Redirects an already signed-in operator away from /login. */
export const PublicOnlyRoute = ({ children }) => {
  const isAuthenticated = useSelector(selectIsAuthenticated)
  if (isAuthenticated) return <Navigate to="/" replace />
  return children
}
