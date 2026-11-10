import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../auth/useAuth.js'
import ForbiddenPage from '../pages/ForbiddenPage.jsx'

/**
 * Gate for signed-in areas. The server enforces every rule again; this only keeps the UI honest.
 * @param {{ allowedRoles?: string[] }} props
 */
export default function ProtectedRoute({ allowedRoles }) {
  const { user, loading } = useAuth()
  const location = useLocation()

  if (loading) {
    return (
      <p role="status" className="text-slate-600">
        Loading your session…
      </p>
    )
  }
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />
  if (user.mustChangePassword && location.pathname !== '/change-password') {
    return <Navigate to="/change-password" replace />
  }
  if (allowedRoles && !allowedRoles.includes(user.role)) return <ForbiddenPage />

  return <Outlet />
}
