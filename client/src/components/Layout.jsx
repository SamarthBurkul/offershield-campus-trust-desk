import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom'
import { ROLE_LABELS, ROLES, STAFF_ROLES, homePathForRole } from '../auth/roles.js'
import { useAuth } from '../auth/useAuth.js'
import DemoBanner from './DemoBanner.jsx'
import NotificationBell from './NotificationBell.jsx'
import WakingServerBanner from './WakingServerBanner.jsx'

const navClass = ({ isActive }) =>
  `text-sm font-medium ${isActive ? 'text-blue-900' : 'text-slate-600 hover:text-blue-800'}`

function navLinksFor(user) {
  if (!user || user.mustChangePassword || user.status === 'pending_approval') return []
  if (user.role === ROLES.SUPER_ADMIN) return [{ to: '/admin', label: 'Colleges' }]
  if (STAFF_ROLES.includes(user.role)) {
    return [
      { to: '/staff', label: 'Home', end: true },
      { to: '/staff/cases', label: 'Case desk' },
      { to: '/staff/registry', label: 'Registry' },
      { to: '/staff/advisories', label: 'Advisories' },
      { to: '/staff/students', label: 'Students' },
      { to: '/staff/stats', label: 'Stats' },
      { to: '/staff/members', label: 'Staff' },
      ...(user.role === ROLES.TPO_HEAD ? [{ to: '/staff/audit', label: 'Audit log' }] : []),
    ]
  }
  return [
    { to: homePathForRole(user.role), label: 'Home', end: true },
    { to: '/student/requests', label: 'My requests' },
    { to: '/advisories', label: 'Advisories' },
  ]
}

export default function Layout() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  async function handleLogout() {
    await logout()
    navigate('/login', { replace: true })
  }

  return (
    <div className="flex min-h-screen flex-col bg-slate-50 text-slate-800">
      <WakingServerBanner />
      <DemoBanner />
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-4xl flex-wrap items-center justify-between gap-3 px-4 py-4">
          <div className="flex flex-wrap items-center gap-6">
            <Link to="/" className="text-lg font-semibold text-blue-900">
              OfferShield — Campus Trust Desk
            </Link>
            <nav className="flex flex-wrap gap-x-4 gap-y-1" aria-label="Main">
              {navLinksFor(user).map((link) => (
                <NavLink key={link.to} to={link.to} end={link.end} className={navClass}>
                  {link.label}
                </NavLink>
              ))}
            </nav>
          </div>
          {user ? (
            <div className="flex flex-wrap items-center gap-3 text-sm">
              {user.collegeId && !user.mustChangePassword && user.status !== 'pending_approval' && <NotificationBell />}
              <span className="text-slate-700">
                <span className="font-medium text-slate-900">{user.name}</span> · {ROLE_LABELS[user.role]}
              </span>
              <button
                type="button"
                onClick={handleLogout}
                className="rounded-md border border-slate-300 px-3 py-1.5 font-medium text-slate-700 hover:bg-slate-50"
              >
                Log out
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-4 text-sm">
              <NavLink to="/login" className={navClass}>
                Sign in
              </NavLink>
              <NavLink to="/register" className={navClass}>
                Student registration
              </NavLink>
            </div>
          )}
        </div>
      </header>

      <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-10">
        <Outlet />
      </main>

      <footer className="border-t border-slate-200 bg-white">
        <div className="mx-auto flex max-w-4xl flex-wrap items-center justify-between gap-2 px-4 py-4 text-sm text-slate-500">
          <p>OfferShield helps your placement cell review opportunities. It never certifies an offer as safe.</p>
          <nav aria-label="Legal" className="flex gap-4">
            <Link to="/privacy" className="hover:text-blue-800 hover:underline">
              Privacy
            </Link>
            <Link to="/terms" className="hover:text-blue-800 hover:underline">
              Terms
            </Link>
          </nav>
        </div>
      </footer>
    </div>
  )
}
