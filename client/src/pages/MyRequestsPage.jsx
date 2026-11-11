import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { listMyCases } from '../api/cases.js'
import { errorMessage } from '../api/errors.js'
import StatusBadge from '../components/StatusBadge.jsx'
import { Card, ErrorAlert, SelectField } from '../components/ui.jsx'
import { CHANNEL_LABELS, STUDENT_STATUS_LABELS } from '../constants/caseStatus.js'
import usePageTitle from '../hooks/usePageTitle.js'
import Skeleton from '../components/Skeleton.jsx'
import EmptyState from '../components/EmptyState.jsx'

export default function MyRequestsPage() {
  usePageTitle('My requests')
  const [status, setStatus] = useState('')
  const [result, setResult] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    listMyCases({ status: status || undefined, limit: 50 })
      .then((data) => {
        if (!active) return
        setResult(data)
        setError('')
      })
      .catch((err) => active && setError(errorMessage(err, 'Could not load your requests.')))
    return () => {
      active = false
    }
  }, [status])

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <h1 className="text-2xl font-bold text-slate-900">My requests</h1>
        <Link
          to="/student/requests/new"
          className="rounded-md bg-blue-700 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-800"
        >
          New request
        </Link>
      </div>

      <Card>
        <div className="max-w-xs">
          <SelectField label="Filter by status" value={status} onChange={(event) => setStatus(event.target.value)}>
            <option value="">All requests</option>
            {Object.entries(STUDENT_STATUS_LABELS).map(([value, text]) => (
              <option key={value} value={value}>
                {text}
              </option>
            ))}
          </SelectField>
        </div>
        <ErrorAlert message={error} />
        {!result && !error && <Skeleton rows={3} label="Loading your requests" />}
        {result?.cases.length === 0 && <EmptyState title="No requests yet.">If an offer looks suspicious, ask your placement cell to verify it.</EmptyState>}
        {result?.cases.length > 0 && (
          <ul className="divide-y divide-slate-100">
            {result.cases.map((item) => (
              <li key={item.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <div>
                  <Link to={`/student/requests/${item.id}`} className="font-medium text-blue-700 hover:underline">
                    {item.claimedCompany}
                  </Link>
                  <p className="text-sm text-slate-500">
                    {item.caseNumber} · {CHANNEL_LABELS[item.channel] ?? item.channel} ·{' '}
                    {new Date(item.createdAt).toLocaleDateString()}
                  </p>
                </div>
                <StatusBadge status={item.status} />
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  )
}
