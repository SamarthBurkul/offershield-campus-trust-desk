import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { getCaseCounts } from '../api/staffCases.js'
import { ROLE_LABELS, ROLES } from '../auth/roles.js'
import { useAuth } from '../auth/useAuth.js'
import { Card } from '../components/ui.jsx'

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
  const [counts, setCounts] = useState(null)

  useEffect(() => {
    let active = true
    getCaseCounts()
      .then((value) => active && setCounts(value))
      .catch(() => active && setCounts(null))
    return () => {
      active = false
    }
  }, [])

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

      <Card title="Staff desk">
        <ul className="space-y-2">
          <li>
            <Link to="/staff/cases" className="font-medium text-blue-700 hover:underline">
              Case desk
            </Link>
            <span className="text-sm text-slate-600"> — triage, investigate and {isHead ? 'decide' : 'recommend on'} student requests</span>
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
