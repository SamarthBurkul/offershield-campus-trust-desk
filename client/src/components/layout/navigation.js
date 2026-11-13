import { BarChart3, Building2, FileClock, Home, Inbox, Megaphone, ShieldCheck, UserCog, Users } from 'lucide-react'
import { ROLES, STAFF_ROLES } from '../../auth/roles.js'

/** Sidebar groups. Visibility only — every route keeps its own server and ProtectedRoute checks. */
export function navGroupsFor(user) {
  if (!user || user.mustChangePassword || user.status === 'pending_approval') return []
  if (user.role === ROLES.SUPER_ADMIN) return [{ label: 'Admin', items: [{ to: '/admin', label: 'Colleges', icon: Building2, end: true }] }]
  if (!STAFF_ROLES.includes(user.role)) return []
  const isHead = user.role === ROLES.TPO_HEAD
  return [
    {
      label: 'Desk',
      items: [
        { to: '/staff', label: 'Home', icon: Home, end: true },
        { to: '/staff/cases', label: 'Case desk', icon: Inbox, count: 'open' },
        { to: '/staff/students', label: 'Students', icon: Users, count: 'pendingStudents' },
      ],
    },
    {
      label: 'Trust',
      items: [
        { to: '/staff/registry', label: 'Registry', icon: ShieldCheck },
        { to: '/staff/advisories', label: 'Advisories', icon: Megaphone },
      ],
    },
    {
      label: 'Insights',
      items: [
        { to: '/staff/stats', label: 'Stats', icon: BarChart3 },
        isHead && { to: '/staff/audit', label: 'Audit log', icon: FileClock },
      ].filter(Boolean),
    },
    isHead && { label: 'Team', items: [{ to: '/staff/members', label: 'Staff', icon: UserCog }] },
  ].filter(Boolean)
}

