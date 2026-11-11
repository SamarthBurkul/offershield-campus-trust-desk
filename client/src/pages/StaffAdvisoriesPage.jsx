import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { listStaffAdvisories } from '../api/advisories.js'
import { errorMessage } from '../api/errors.js'
import EmptyState from '../components/EmptyState.jsx'
import Skeleton from '../components/Skeleton.jsx'
import { Card, ErrorAlert } from '../components/ui.jsx'
import usePageTitle from '../hooks/usePageTitle.js'

const TABS = [
  { value: 'draft', label: 'Drafts' },
  { value: 'published', label: 'Published' },
  { value: 'withdrawn', label: 'Withdrawn' },
]
const SEVERITY_BADGES = { critical: 'bg-red-100 text-red-800', warning: 'bg-amber-100 text-amber-900', info: 'bg-blue-100 text-blue-800' }

export default function StaffAdvisoriesPage() {
  usePageTitle('Advisories')
  const [status, setStatus] = useState('draft')
  const [result, setResult] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    listStaffAdvisories({ status, limit: 50 })
      .then((data) => active && setResult({ ...data, status }))
      .catch((err) => active && setError(errorMessage(err, 'Could not load advisories.')))
    return () => {
      active = false
    }
  }, [status])

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h1 className="text-2xl font-bold text-slate-900">Advisories</h1>
        <Link to="/staff/advisories/new" className="rounded-md bg-blue-700 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-800">
          New advisory
        </Link>
      </div>
      <div role="tablist" aria-label="Advisory status" className="flex gap-2">
        {TABS.map((tab) => (
          <button
            key={tab.value}
            type="button"
            role="tab"
            aria-selected={status === tab.value}
            onClick={() => setStatus(tab.value)}
            className={`rounded-full px-3 py-1.5 text-sm font-medium ${status === tab.value ? 'bg-blue-700 text-white' : 'bg-white text-slate-700 ring-1 ring-slate-300'}`}
          >
            {tab.label}
          </button>
        ))}
      </div>
      <Card>
        <ErrorAlert message={error} />
        {(!result || result.status !== status) && !error && <Skeleton rows={3} label="Loading advisories" />}
        {result?.status === status && result.advisories.length === 0 && (
          <EmptyState title={`No ${TABS.find((tab) => tab.value === status).label.toLowerCase()} yet`}>
            Draft an advisory from a confirmed fraud case, or start a new one.
          </EmptyState>
        )}
        {result?.status === status && result.advisories.length > 0 && (
          <ul className="divide-y divide-slate-100">
            {result.advisories.map((advisory) => (
              <li key={advisory.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <div className="space-y-1">
                  <Link to={`/staff/advisories/${advisory.id}`} className="font-medium text-blue-700 hover:underline">
                    {advisory.title}
                  </Link>
                  <p className="text-xs text-slate-500">
                    {advisory.target.years.length ? `Years ${advisory.target.years.join(', ')}` : 'All years'} ·{' '}
                    {advisory.target.branches.length ? advisory.target.branches.join(', ') : 'All branches'}
                    {advisory.status === 'published' && ` · ${Math.round(advisory.ackRate * 100)}% acknowledged (${advisory.acknowledgedCount}/${advisory.audienceCount ?? 0})`}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {advisory.needsReview && <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-900">Needs review</span>}
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${SEVERITY_BADGES[advisory.severity]}`}>{advisory.severity}</span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  )
}
