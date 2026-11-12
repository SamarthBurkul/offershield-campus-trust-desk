import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { getCaseCounts } from '../api/staffCases.js'
import { listStudents } from '../api/students.js'
import { ROLE_LABELS, ROLES } from '../auth/roles.js'
import { useAuth } from '../auth/useAuth.js'
import LookupBox from '../components/LookupBox.jsx'
import { Card } from '../components/ui.jsx'
import usePageTitle from '../hooks/usePageTitle.js'

const COUNT_CARDS = [
  { key: 'open', label: 'Open cases', to: '/staff/cases?status=open' },
  { key: 'submitted', label: 'New (submitted)', to: '/staff/cases?status=submitted' },
  { key: 'under_review', label: 'Under review', to: '/staff/cases?status=under_review' },
  { key: 'awaiting_student', label: 'Awaiting student', to: '/staff/cases?status=awaiting_student' },
  { key: 'unassignedOpen', label: 'Unassigned', to: '/staff/cases?status=open&assignee=unassigned' },
  { key: 'staleOpen', label: 'Stale', to: '/staff/cases?status=open' },
  { key: 'closed', label: 'Closed', to: '/staff/cases?status=closed' },
]

export default function StaffHomePage() {
  const { user, college } = useAuth()
  const isHead = user.role === ROLES.TPO_HEAD
  usePageTitle('Staff home')
  const [counts, setCounts] = useState(null)
  const [pendingStudents, setPendingStudents] = useState(null)
  const manualApproval = college?.studentVerification === 'manual_approval'

  useEffect(() => {
    let active = true
    getCaseCounts()
      .then((value) => active && setCounts(value))
      .catch(() => active && setCounts(null))
    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    if (!manualApproval) return undefined
    let active = true
    listStudents({ status: 'pending_approval', limit: 1 })
      .then((value) => active && setPendingStudents(value.pendingCount))
      .catch(() => {})
    return () => {
      active = false
    }
  }, [manualApproval])

  return (
    <div className="space-y-6">
      <section className="space-y-1">
        <h1 className="text-2xl font-bold text-slate-900">Welcome, {user.name}</h1>
        <p className="text-slate-600">
          {ROLE_LABELS[user.role]}
          {college ? ` · ${college.name}` : ''}
        </p>
      </section>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {COUNT_CARDS.map((card) => (
          <Link key={card.key} to={card.to} className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm hover:border-blue-300">
            <p className="text-2xl font-bold text-slate-900">{counts ? counts[card.key] : '–'}</p>
            <p className="text-sm text-slate-600">{card.label}</p>
          </Link>
        ))}
      </div>

      {manualApproval && (
        <Link
          to="/staff/students?tab=pending"
          className="flex items-center justify-between rounded-lg border border-amber-300 bg-amber-50 p-4 shadow-sm hover:border-amber-400"
        >
          <span className="text-sm font-medium text-amber-900">Students awaiting approval</span>
          <span className="text-2xl font-bold text-amber-900">{pendingStudents ?? '–'}</span>
        </Link>
      )}

      <LookupBox staff />

      <Card title="Staff desk">
        <ul className="space-y-2">
          <li>
            <Link to="/staff/cases" className="font-medium text-blue-700 hover:underline">
              Case desk
            </Link>
            <span className="text-sm text-slate-600"> — triage, investigate and {isHead ? 'decide' : 'recommend on'} student requests</span>
          </li>
          <li>
            <Link to="/staff/advisories" className="font-medium text-blue-700 hover:underline">
              Advisories
            </Link>
            <span className="text-sm text-slate-600"> — warn targeted students about confirmed scams</span>
          </li>
          <li>
            <Link to="/staff/students" className="font-medium text-blue-700 hover:underline">
              Students
            </Link>
            <span className="text-sm text-slate-600"> — approve registrations, reset passwords, disable accounts</span>
          </li>
          <li>
            <Link to="/staff/stats" className="font-medium text-blue-700 hover:underline">
              Statistics
            </Link>
            <span className="text-sm text-slate-600"> — what the desk has caught and how fast</span>
          </li>
          <li>
            <Link to="/staff/registry" className="font-medium text-blue-700 hover:underline">
              College registry
            </Link>
            <span className="text-sm text-slate-600"> — verified recruiters and confirmed fraud indicators</span>
          </li>
          {isHead && (
            <li>
              <Link to="/staff/audit" className="font-medium text-blue-700 hover:underline">
                Audit log
              </Link>
            </li>
          )}
          <li>
            <Link to="/staff/members" className="font-medium text-blue-700 hover:underline">
              {isHead ? 'Staff' : 'View staff members'}
            </Link>
          </li>
        </ul>
      </Card>
    </div>
  )
}
