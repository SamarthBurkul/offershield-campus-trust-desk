import clsx from 'clsx'
import { Link, NavLink, Outlet } from 'react-router-dom'
import { homePathForRole } from '../../auth/roles.js'
import { useAuth } from '../../auth/useAuth.js'
import WakingServerBanner from '../WakingServerBanner.jsx'
import { buttonClasses } from '../ui/index.js'
import { SiteFooter } from './Chrome.jsx'
import { Logo } from './Logo.jsx'

/**
 * Marketing layout for signed-out visitors and the public pages. `fullBleed` pages (landing, login, register)
 * draw their own navy hero under the header; other pages get a readable centred column.
 */
export default function PublicLayout({ fullBleed = false }) {
  const { user } = useAuth()

  return (
    <div className="flex min-h-screen flex-col bg-slate-50">
      <WakingServerBanner />
      <header className="bg-brand-950 text-white">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
          <Link to="/" className="rounded-lg">
            <Logo tone="light" />
          </Link>
          {user ? (
            <Link to={homePathForRole(user.role)} className={buttonClasses({ variant: 'secondary', size: 'sm' })}>
              Go to your desk
            </Link>
          ) : (
            <nav aria-label="Account" className="flex items-center gap-2 text-sm">
              <NavLink to="/login" className={({ isActive }) => clsx('rounded-lg px-3 py-1.5 font-medium transition', isActive ? 'text-white' : 'text-brand-100 hover:text-white')}>
                Sign in
              </NavLink>
              <NavLink to="/register" className={buttonClasses({ variant: 'primary', size: 'sm' })}>
                Student registration
              </NavLink>
            </nav>
          )}
        </div>
      </header>
      <main className={clsx('flex-1', !fullBleed && 'mx-auto w-full max-w-5xl px-4 py-10 sm:px-6')}>
        <Outlet />
      </main>
      <SiteFooter />
    </div>
  )
}
