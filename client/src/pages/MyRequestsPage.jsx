import { ChevronRight, FilePlus2, FileSearch } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { listMyCases } from '../api/cases.js'
import { errorMessage } from '../api/errors.js'
import StatusBadge from '../components/StatusBadge.jsx'
import { ButtonLink, Card, EmptyState, ErrorAlert, PageHeader, SelectField, Skeleton } from '../components/ui/index.js'
import { CHANNEL_LABELS, STUDENT_STATUS_LABELS } from '../constants/caseStatus.js'
import usePageTitle from '../hooks/usePageTitle.js'
import { formatDate } from '../utils/format.js'

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
      <PageHeader
        title="My requests"
        description="Offers you asked your placement cell to verify, newest first."
        actions={
          <ButtonLink to="/student/requests/new" icon={FilePlus2}>
            New request
          </ButtonLink>
        }
      />

      <Card padded={false}>
        <div className="flex flex-wrap items-end justify-between gap-3 border-b border-slate-100 px-5 py-4">
          <div className="w-full max-w-xs">
            <SelectField label="Filter by status" value={status} onChange={(event) => setStatus(event.target.value)}>
              <option value="">All requests</option>
              {Object.entries(STUDENT_STATUS_LABELS).map(([value, text]) => (
                <option key={value} value={value}>
                  {text}
                </option>
              ))}
            </SelectField>
          </div>
          {result && <p className="text-sm text-slate-500">{result.total} request{result.total === 1 ? '' : 's'}</p>}
        </div>
        <div className="p-5">
          <ErrorAlert message={error} />
          {!result && !error && <Skeleton rows={3} label="Loading your requests" />}
          {result?.cases.length === 0 && (
            <EmptyState
              icon={FileSearch}
              title="No requests yet."
              action={
                <ButtonLink to="/student/requests/new" icon={FilePlus2}>
                  Ask your placement cell
                </ButtonLink>
              }
            >
              If an offer looks suspicious, ask your placement cell to verify it.
            </EmptyState>
          )}
          {result?.cases.length > 0 && (
            <>
              <div className="hidden grid-cols-[minmax(0,2fr)_minmax(0,1.2fr)_minmax(0,1fr)_minmax(0,1fr)_1.5rem] gap-4 px-4 pb-2 text-xs font-semibold uppercase tracking-wide text-slate-500 md:grid" aria-hidden="true">
                <span>Company</span>
                <span>Request</span>
                <span>Submitted</span>
                <span>Status</span>
              </div>
              <ul className="space-y-2 md:space-y-0 md:divide-y md:divide-slate-100 md:rounded-xl md:ring-1 md:ring-slate-900/5">
                {result.cases.map((item) => (
                  <li key={item.id}>
                    <Link
                      to={`/student/requests/${item.id}`}
                      className="group grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-1 rounded-xl bg-white p-4 ring-1 ring-slate-900/5 transition hover:bg-accent-50/40 md:grid-cols-[minmax(0,2fr)_minmax(0,1.2fr)_minmax(0,1fr)_minmax(0,1fr)_1.5rem] md:rounded-none md:ring-0"
                    >
                      <span className="min-w-0">
                        <span className="block truncate font-medium text-slate-900 group-hover:text-accent-800">{item.claimedCompany}</span>
                        <span className="block text-xs text-slate-500 md:hidden">Submitted {formatDate(item.createdAt)}</span>
                      </span>
                      <span className="hidden text-sm text-slate-600 md:block">
                        <span className="block font-mono text-xs text-slate-700">{item.caseNumber}</span>
                        <span className="block text-xs text-slate-500">{CHANNEL_LABELS[item.channel] ?? item.channel}</span>
                      </span>
                      <span className="hidden text-sm text-slate-600 md:block">{formatDate(item.createdAt)}</span>
                      <span>
                        <StatusBadge status={item.status} />
                      </span>
                      <ChevronRight className="hidden h-4 w-4 text-slate-400 md:block" aria-hidden="true" />
                    </Link>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      </Card>
    </div>
  )
}
