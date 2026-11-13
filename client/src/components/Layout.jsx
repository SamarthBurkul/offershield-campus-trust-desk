import { useLocation } from 'react-router-dom'
import { ROLES } from '../auth/roles.js'
import { useAuth } from '../auth/useAuth.js'
import AppShell from './layout/AppShell.jsx'
import PublicLayout from './layout/PublicLayout.jsx'
import StudentShell from './layout/StudentShell.jsx'

// Marketing pages always use the public layout, with their own full-bleed hero.
const MARKETING_PATHS = new Set(['/', '/login', '/register'])

/**
 * Chooses the shell for the current user (presentation only — ProtectedRoute and the server enforce access):
 * public pages and signed-out visitors → PublicLayout; students → StudentShell; staff and super admin → AppShell.
 */
export default function Layout() {
  const { user, loading } = useAuth()
  const { pathname } = useLocation()

  if (MARKETING_PATHS.has(pathname)) return <PublicLayout fullBleed />
  // While the session loads, protected routes only show a loading line, so the public frame is safe here.
  if (loading || !user) return <PublicLayout />
  if (user.role === ROLES.STUDENT) return <StudentShell />
  return <AppShell />
}
