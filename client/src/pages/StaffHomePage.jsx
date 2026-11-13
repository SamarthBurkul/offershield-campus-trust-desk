import {
  ArrowRight,
  BarChart3,
  CircleCheck,
  Clock3,
  FileClock,
  Hourglass,
  Inbox,
  Megaphone,
  MessageCircleQuestion,
  ShieldCheck,
  UserCog,
  UserRoundX,
  Users,
} from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { getCaseCounts, listStaffCases } from '../api/staffCases.js'
import { listStudents } from '../api/students.js'
import { ROLE_LABELS, ROLES } from '../auth/roles.js'
import { useAuth } from '../auth/useAuth.js'
import { useNavCounts } from '../components/layout/navCountsContext.js'
import LookupBox from '../components/LookupBox.jsx'
import StatusBadge from '../components/StatusBadge.jsx'
import { Avatar, Card, PageHeader } from '../components/ui/index.js'
import usePageTitle from '../hooks/usePageTitle.js'
import { formatDateTime, relativeTime } from '../utils/format.js'

const KPIS = [
  { key: 'open', label: 'Open cases', to: '/staff/cases?status=open', icon: Inbox, tone: 'bg-accent-50 text-accent-700' },
  { key: 'submitted', label: 'New (submitted)', to: '/staff/cases?status=submitted', icon: CircleCheck, tone: 'bg-sky-50 text-sky-700' },
  { key: 'under_review', label: 'Under review', to: '/staff/cases?status=under_review', icon: FileClock, tone: 'bg-brand-50 text-brand-700' },
  { key: 'awaiting_student', label: 'Awaiting student', to: '/staff/cases?status=awaiting_student', icon: MessageCircleQuestion, tone: 'bg-amber-50 text-amber-700' },
  { key: 'unassignedOpen', label: 'Unassigned', to: '/staff/cases?status=open&assignee=unassigned', icon: UserRoundX, tone: 'bg-rose-50 text-rose-700' },
  { key: 'staleOpen', label: 'Stale', to: '/staff/cases?status=open', icon: Clock3, tone: 'bg-amber-50 text-amber-700' },
  { key: 'closed', label: 'Closed', to: '/staff/cases?status=closed', icon: ShieldCheck, tone: 'bg-emerald-50 text-emerald-700' },
]

/** Runs an API call lazily so a failure (or an unavailable endpoint) only hides an optional panel. */
const optional = (call) => Promise.resolve().then(call)

function CaseMiniList({ cases, empty }) {
  if (cases === null) return <p className="px-5 py-4 text-sm text-slate-500">Loading…</p>
  if (cases.length === 0) return <p className="px-5 py-4 text-sm text-slate-500">{empty}</p>
  return (
    <ul className="divide-y divide-slate-100">
      {cases.slice(0, 5).map((item) => (
        <li key={item.id}>
          <Link to={`/staff/cases/${item.id}`} className="flex items-center gap-3 px-5 py-3 transition hover:bg-slate-50">
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium text-slate-900">{item.claimedCompany}</span>
              <span className="block text-xs text-slate-500">
                <span className="font-mono">{item.caseNumber}</span> ·{' '}
                <span title={formatDateTime(item.lastActivityAt)}>{relativeTime(item.lastActivityAt)}</span>
              </span>
            </span>
            <StatusBadge status={item.status} audience="staff" size="sm" />
          </Link>
        </li>
      ))}
    </ul>
  )
}

function AttentionPanel({ title, icon: Icon, to, count, children }) {
  return (
    <Card
      title={title}
      icon={Icon}
      padded={false}
      actions={
        <Link to={to} className="inline-flex items-center gap-1 text-sm font-medium text-accent-700 hover:text-accent-800">
          {count != null ? `View all (${count})` : 'View all'} <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
        </Link>
      }
    >
      {children}
    </Card>
  )
}

export default function StaffHomePage() {
  const { user, college } = useAuth()
  const { publish } = useNavCounts()
  const isHead = user.role === ROLES.TPO_HEAD
  usePageTitle('Staff home')
  const [counts, setCounts] = useState(null)
  const [openCases, setOpenCases] = useState(null)
  const [pending, setPending] = useState(null)
  const manualApproval = college?.studentVerification === 'manual_approval'

  useEffect(() => {
    let active = true
    getCaseCounts()
      .then((value) => {
        if (!active) return
        setCounts(value)
        publish({ open: value?.open })
      })
      .catch(() => active && setCounts(null))
    return () => {
      active = false
    }
  }, [publish])

  // One existing-endpoint call feeds the unassigned, stale and awaiting-student panels.
  useEffect(() => {
    let active = true
    optional(() => listStaffCases({ status: 'open', limit: 50 }))
      .then((data) => active && setOpenCases(data?.cases ?? []))
      .catch(() => active && setOpenCases([]))
    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    if (!manualApproval) return undefined
    let active = true
    listStudents({ status: 'pending_approval', limit: 5 })
      .then((value) => {
        if (!active) return
        setPending(value)
        publish({ pendingStudents: value.pendingCount })
      })
      .catch(() => {})
    return () => {
      active = false
    }
  }, [manualApproval, publish])

  const unassigned = openCases && openCases.filter((item) => !item.assignee)
  const stale = openCases && openCases.filter((item) => item.isStale)
  const awaiting = openCases && openCases.filter((item) => item.status === 'awaiting_student')

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow={college ? college.name : undefined}
        title={`Welcome, ${user.name}`}
        description={`${ROLE_LABELS[user.role]} · what needs your attention today.`}
      />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 xl:grid-cols-7">
        {KPIS.map((card) => (
          <Link
            key={card.key}
            to={card.to}
            className="group rounded-2xl bg-white p-4 shadow-card ring-1 ring-slate-900/5 transition duration-150 hover:-translate-y-0.5 hover:shadow-raised"
          >
            <span className={`inline-flex h-8 w-8 items-center justify-center rounded-lg ${card.tone}`} aria-hidden="true">
              <card.icon className="h-4 w-4" />
            </span>
            <p className="mt-3 text-2xl font-semibold tracking-tight text-slate-900 tabular-nums">{counts ? counts[card.key] : '–'}</p>
            <p className="text-sm text-slate-600 group-hover:text-slate-900">{card.label}</p>
          </Link>
        ))}
      </div>

      <section aria-labelledby="attention-heading" className="space-y-3">
        <h2 id="attention-heading" className="text-base font-semibold text-slate-900">
          Needs attention
        </h2>
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2 2xl:grid-cols-4">
          <AttentionPanel title="Unassigned" icon={UserRoundX} to="/staff/cases?status=open&assignee=unassigned" count={counts?.unassignedOpen}>
            <CaseMiniList cases={unassigned} empty="Every open case has an owner." />
          </AttentionPanel>
          <AttentionPanel title="Stale" icon={Clock3} to="/staff/cases?status=open" count={counts?.staleOpen}>
            <CaseMiniList cases={stale} empty="No open case has gone quiet." />
          </AttentionPanel>
          <AttentionPanel title="Awaiting student" icon={MessageCircleQuestion} to="/staff/cases?status=awaiting_student" count={counts?.awaiting_student}>
            <CaseMiniList cases={awaiting} empty="No case is waiting for a student reply." />
          </AttentionPanel>
          {manualApproval && (
            <Card
              title="Pending approvals"
              icon={Hourglass}
              padded={false}
              actions={
                <Link
                  to="/staff/students?tab=pending"
                  className="inline-flex items-center gap-2 rounded-lg bg-amber-50 px-2.5 py-1 text-sm font-medium text-amber-900 ring-1 ring-inset ring-amber-300 transition hover:bg-amber-100"
                >
                  <span>Students awaiting approval</span>
                  <span className="font-semibold tabular-nums">{pending?.pendingCount ?? '–'}</span>
                </Link>
              }
            >
              {pending === null ? (
                <p className="px-5 py-4 text-sm text-slate-500">Loading…</p>
              ) : pending.students.length === 0 ? (
                <p className="px-5 py-4 text-sm text-slate-500">No students are waiting for approval.</p>
              ) : (
                <ul className="divide-y divide-slate-100">
                  {pending.students.map((student) => (
                    <li key={student.id} className="flex items-center gap-3 px-5 py-3">
                      <Avatar name={student.name} size="sm" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium text-slate-900">{student.name}</span>
                        <span className="block truncate text-xs text-slate-500">
                          {student.branch} · Year {student.year}
                        </span>
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          )}
        </div>
      </section>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <LookupBox staff />
        <Card title="Shortcuts">
          <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
            {[
              { to: '/staff/cases', label: 'Case desk', icon: Inbox, hint: `triage, investigate and ${isHead ? 'decide' : 'recommend on'} student requests` },
              { to: '/staff/students', label: 'Students', icon: Users, hint: 'approve registrations, reset passwords, disable accounts' },
              { to: '/staff/advisories', label: 'Advisories', icon: Megaphone, hint: 'warn targeted students about confirmed scams' },
              { to: '/staff/stats', label: 'Statistics', icon: BarChart3, hint: 'what the desk has caught and how fast' },
              { to: '/staff/registry', label: 'College registry', icon: ShieldCheck, hint: 'verified recruiters and confirmed fraud indicators' },
              isHead && { to: '/staff/audit', label: 'Audit log', icon: FileClock, hint: 'every important action, append-only' },
              { to: '/staff/members', label: isHead ? 'Staff' : 'View staff members', icon: UserCog, hint: 'placement officers and the TPO head' },
            ]
              .filter(Boolean)
              .map((item) => (
                <li key={item.to}>
                  <Link to={item.to} className="flex items-start gap-3 rounded-xl p-2.5 transition hover:bg-slate-50">
                    <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-700" aria-hidden="true">
                      <item.icon className="h-4 w-4" />
                    </span>
                    <span>
                      <span className="block text-sm font-semibold text-slate-900">{item.label}</span>
                      <span className="block text-xs leading-5 text-slate-500">{item.hint}</span>
                    </span>
                  </Link>
                </li>
              ))}
          </ul>
        </Card>
      </div>
    </div>
  )
}
