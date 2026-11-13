import clsx from 'clsx'
import { FileSearch, Home, Megaphone, Menu } from 'lucide-react'
import { useState } from 'react'
import { Link, NavLink, Outlet } from 'react-router-dom'
import { isRestricted } from '../../auth/accountState.js'
import { useAuth } from '../../auth/useAuth.js'
import DemoBanner from '../DemoBanner.jsx'
import NotificationBell from '../NotificationBell.jsx'
import WakingServerBanner from '../WakingServerBanner.jsx'
import { Drawer, IconButton } from '../ui/index.js'
import { SiteFooter, UserMenu } from './Chrome.jsx'
import { Logo } from './Logo.jsx'

const STUDENT_NAV = [
  { to: '/student', label: 'Home', icon: Home, end: true },
  { to: '/student/requests', label: 'My requests', icon: FileSearch },
  { to: '/advisories', label: 'Advisories', icon: Megaphone },
]

/** Student shell: navy top bar (nav moves into a sheet below md) and a readable content column. */
export default function StudentShell() {
  const { user, emailVerificationRequired } = useAuth()
  const [sheetOpen, setSheetOpen] = useState(false)
  const restricted = isRestricted(user, emailVerificationRequired)
  const links = restricted ? [] : STUDENT_NAV

  const navClass = (mobile) => ({ isActive }) =>
    clsx(
      'flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium transition-colors duration-150',
      mobile
        ? isActive
          ? 'bg-accent-50 text-accent-800'
          : 'text-slate-700 hover:bg-slate-100'
        : isActive
          ? 'bg-white/10 text-white'
          : 'text-brand-100 hover:bg-white/5 hover:text-white',
    )

  return (
    <div className="flex min-h-screen flex-col bg-slate-50 text-[15px]">
      <WakingServerBanner />
      <DemoBanner />
      <header className="bg-brand-950 text-white shadow-sm">
        <div className="mx-auto flex h-16 max-w-5xl items-center gap-4 px-4 sm:px-6">
          <Link to="/student" className="shrink-0 rounded-lg">
            <Logo tone="light" />
          </Link>
          {links.length > 0 && (
            <nav aria-label="Main" className="ml-4 hidden items-center gap-1 md:flex">
              {links.map((link) => (
                <NavLink key={link.to} to={link.to} end={link.end} className={navClass(false)}>
                  {link.label}
                </NavLink>
              ))}
            </nav>
          )}
          <div className="ml-auto flex items-center gap-1">
            {!restricted && <NotificationBell tone="dark" />}
            <UserMenu tone="dark" />
            {links.length > 0 && (
              <IconButton
                icon={Menu}
                label="Open menu"
                className="text-brand-100! hover:bg-white/10! hover:text-white! md:hidden"
                aria-expanded={sheetOpen}
                onClick={() => setSheetOpen(true)}
              />
            )}
          </div>
        </div>
      </header>
      {sheetOpen && (
        <Drawer title="Menu" width="max-w-xs" onClose={() => setSheetOpen(false)}>
          <nav aria-label="Mobile" className="space-y-1">
            {links.map((link) => (
              <NavLink key={link.to} to={link.to} end={link.end} className={navClass(true)} onClick={() => setSheetOpen(false)}>
                <link.icon className="h-4 w-4" aria-hidden="true" />
                {link.label}
              </NavLink>
            ))}
          </nav>
        </Drawer>
      )}
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8 sm:px-6">
        <Outlet />
      </main>
      <SiteFooter />
    </div>
  )
}
