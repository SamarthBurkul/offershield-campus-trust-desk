import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { needsEmailVerification } from '../auth/accountState.js'
import { useAuth } from '../auth/useAuth.js'
import ForbiddenPage from '../pages/ForbiddenPage.jsx'
import { Spinner } from './ui/index.js'

/**
 * Gate for signed-in areas. The server enforces every rule again; this only keeps the UI honest.
 * @param {{ allowedRoles?: string[] }} props
 */
export default function ProtectedRoute({ allowedRoles }) {
  const { user, loading, emailVerificationRequired } = useAuth()
  const location = useLocation()

  if (loading) {
    return (
      <p role="status" className="flex items-center justify-center gap-2 py-16 text-sm text-slate-500">
        <Spinner /> Loading your session…
      </p>
    )
  }
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />
  // Gate order: confirm the email address, then wait for approval, then replace a temporary password.
  const unverified = needsEmailVerification(user, emailVerificationRequired)
  if (unverified) {
    if (location.pathname !== '/verify-email') return <Navigate to="/verify-email" replace />
    return <Outlet />
  }
  // Students of a manual-approval college wait here until staff approve the account.
  if (user.status === 'pending_approval' && location.pathname !== '/pending-approval') {
    return <Navigate to="/pending-approval" replace />
  }
  if (user.mustChangePassword && user.status !== 'pending_approval' && location.pathname !== '/change-password') {
    return <Navigate to="/change-password" replace />
  }
  if (allowedRoles && !allowedRoles.includes(user.role)) return <ForbiddenPage />

  return <Outlet />
}
