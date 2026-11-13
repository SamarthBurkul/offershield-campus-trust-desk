import clsx from 'clsx'
import { Menu } from 'lucide-react'
import { useState } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { STAFF_ROLES } from '../../auth/roles.js'
import { useAuth } from '../../auth/useAuth.js'
import DemoBanner from '../DemoBanner.jsx'
import NotificationBell from '../NotificationBell.jsx'
import WakingServerBanner from '../WakingServerBanner.jsx'
import { Drawer, IconButton } from '../ui/index.js'
import { QuickLookup, SiteFooter, UserMenu } from './Chrome.jsx'
import { Logo } from './Logo.jsx'
import { navGroupsFor } from './navigation.js'
import { useNavCounts } from './navCountsContext.js'

// Top-bar title for each area (the page itself shows the full heading).
const SECTION_TITLES = [
  ['/staff/cases/', 'Case'],
  ['/staff/cases', 'Case desk'],
  ['/staff/students', 'Students'],
  ['/staff/registry', 'Registry'],
  ['/staff/advisories', 'Advisories'],
  ['/staff/stats', 'Statistics'],
  ['/staff/audit', 'Audit log'],
  ['/staff/members', 'Staff'],
  ['/staff', 'Home'],
  ['/admin/colleges/', 'College'],
  ['/admin', 'Colleges'],
  ['/notifications', 'Notifications'],
  ['/change-password', 'Change password'],
]

const sectionTitle = (pathname) => SECTION_TITLES.find(([prefix]) => pathname === prefix || pathname.startsWith(prefix.endsWith('/') ? prefix : `${prefix}/`))?.[1] ?? 'OfferShield'

function SidebarNav({ onNavigate }) {
  const { user, college } = useAuth()
  const { counts } = useNavCounts()
  const groups = navGroupsFor(user)

  return (
    <div className="flex h-full flex-col bg-brand-950 text-brand-100">
      <div className="flex h-16 shrink-0 items-center px-5">
        <Logo tone="light" tagline />
      </div>
      {college && (
        <div className="mx-4 mb-4 rounded-xl bg-white/5 px-3 py-2.5 ring-1 ring-inset ring-white/10">
          <p className="text-[11px] font-medium uppercase tracking-wider text-brand-300">College</p>
          <p className="truncate text-sm font-medium text-white" title={college.name}>
            {college.name}
          </p>
        </div>
      )}
      <nav aria-label="Main" className="flex-1 space-y-6 overflow-y-auto px-3 pb-6">
        {groups.map((group) => (
          <div key={group.label}>
            <p className="px-3 pb-1.5 text-[11px] font-semibold uppercase tracking-wider text-brand-300">{group.label}</p>
            <ul className="space-y-0.5">
              {group.items.map((item) => {
                const count = item.count ? counts[item.count] : null
                return (
                  <li key={item.to}>
                    <NavLink
                      to={item.to}
                      end={item.end}
                      onClick={onNavigate}
                      className={({ isActive }) =>
                        clsx(
                          'group flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition-colors duration-150',
                          isActive ? 'bg-white/10 text-white shadow-sm ring-1 ring-inset ring-white/10' : 'text-brand-100 hover:bg-white/5 hover:text-white',
                        )
                      }
                    >
                      {({ isActive }) => (
                        <>
                          <item.icon className={clsx('h-[18px] w-[18px] shrink-0', isActive ? 'text-accent-300' : 'text-brand-300 group-hover:text-brand-100')} aria-hidden="true" />
                          <span className="flex-1">{item.label}</span>
                          {count > 0 && (
                            <span className="rounded-full bg-accent-500/90 px-2 py-px text-[11px] font-semibold tabular-nums text-white" aria-label={`${count} pending`}>
                              {count}
                            </span>
                          )}
                        </>
                      )}
                    </NavLink>
                  </li>
                )
              })}
            </ul>
          </div>
        ))}
      </nav>
    </div>
  )
}

/** Staff, TPO head and super admin shell: navy sidebar (off-canvas below lg) and a top bar. */
export default function AppShell() {
  const { user } = useAuth()
  const location = useLocation()
  const [drawerOpen, setDrawerOpen] = useState(false)
  const showNav = navGroupsFor(user).length > 0
  const isStaff = STAFF_ROLES.includes(user.role)
  const showBell = user.collegeId && !user.mustChangePassword && user.status !== 'pending_approval'

  return (
    <div className="min-h-screen bg-slate-50">
      {showNav && (
        <aside className="fixed inset-y-0 left-0 z-30 hidden w-[260px] lg:block" aria-label="Sidebar">
          <SidebarNav />
        </aside>
      )}
      {drawerOpen && (
        <Drawer title="Navigation" side="left" width="max-w-[280px]" onClose={() => setDrawerOpen(false)} hideHeader bodyClassName="p-0">
          <SidebarNav onNavigate={() => setDrawerOpen(false)} />
        </Drawer>
      )}

      <div className={clsx('flex min-h-screen flex-col', showNav && 'lg:pl-[260px]')}>
        <WakingServerBanner />
        <DemoBanner />
        <header className="sticky top-0 z-20 border-b border-slate-200/80 bg-white/90 backdrop-blur">
          <div className="mx-auto flex h-16 max-w-[1440px] items-center gap-3 px-4 sm:px-6 lg:px-8">
            {showNav && (
              <IconButton icon={Menu} label="Open navigation" className="lg:hidden" onClick={() => setDrawerOpen(true)} aria-expanded={drawerOpen} />
            )}
            <p className="hidden min-w-0 truncate text-sm font-semibold text-slate-900 sm:block lg:w-40">{sectionTitle(location.pathname)}</p>
            <div className="flex min-w-0 flex-1 justify-center">{isStaff && showNav && <QuickLookup />}</div>
            <div className="flex items-center gap-1.5">
              {showBell && <NotificationBell />}
              <UserMenu compact />
            </div>
          </div>
        </header>
        <main className="mx-auto w-full max-w-[1440px] flex-1 px-4 py-8 sm:px-6 lg:px-8">
          <Outlet />
        </main>
        <SiteFooter />
      </div>
    </div>
  )
}
