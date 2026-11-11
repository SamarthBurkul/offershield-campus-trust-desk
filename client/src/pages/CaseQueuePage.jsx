import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { errorMessage } from '../api/errors.js'
import { listStaffCases } from '../api/staffCases.js'
import CaseFilters from '../components/CaseFilters.jsx'
import StatusBadge from '../components/StatusBadge.jsx'
import { Button, Card, ErrorAlert } from '../components/ui.jsx'
import { CHANNEL_LABELS } from '../constants/caseStatus.js'
import { SIGNAL_LABELS } from '../constants/verificationMethods.js'
import { relativeTime } from '../utils/time.js'
import usePageTitle from '../hooks/usePageTitle.js'
import Skeleton from '../components/Skeleton.jsx'
import EmptyState from '../components/EmptyState.jsx'

const FILTER_KEYS = ['status', 'priority', 'assignee', 'channel', 'q', 'page']
const PAGE_SIZE = 20

function PriorityBadge({ priority }) {
  return priority === 'high' ? (
    <span className="rounded-full bg-red-50 px-2 py-0.5 text-xs font-medium text-red-800 ring-1 ring-red-200">High</span>
  ) : (
    <span className="text-xs text-slate-500">Normal</span>
  )
}

export default function CaseQueuePage() {
  usePageTitle('Case desk')
  const [searchParams, setSearchParams] = useSearchParams()
  const values = Object.fromEntries(FILTER_KEYS.map((name) => [name, searchParams.get(name) ?? '']))
  const page = Number(values.page) || 1
  const paramsKey = searchParams.toString()
  const [result, setResult] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    const params = Object.fromEntries(new URLSearchParams(paramsKey))
    listStaffCases({ ...params, status: params.status || 'open', page: Number(params.page) || 1, limit: PAGE_SIZE })
      .then((data) => {
        if (!active) return
        setResult(data)
        setError('')
      })
      .catch((err) => active && setError(errorMessage(err, 'Could not load the case queue.')))
    return () => {
      active = false
    }
  }, [paramsKey])

  function update(patch) {
    const next = new URLSearchParams(searchParams)
    for (const [name, value] of Object.entries(patch)) {
      if (value) next.set(name, String(value))
      else next.delete(name)
    }
    if (!('page' in patch)) next.delete('page')
    setSearchParams(next)
  }

  const totalPages = result ? Math.max(1, Math.ceil(result.total / PAGE_SIZE)) : 1

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-slate-900">Case desk</h1>
      <Card>
        <CaseFilters key={values.q} values={values} onChange={update} />
      </Card>

      <Card>
        <ErrorAlert message={error} />
        {!result && !error && <Skeleton rows={5} label="Loading cases" />}
        {result?.cases.length === 0 && <EmptyState title="No cases match these filters.">Try another tab or clear the search.</EmptyState>}
        {result?.cases.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-200 text-slate-500">
                <tr>
                  <th className="py-2 pr-3 font-medium">Case</th>
                  <th className="py-2 pr-3 font-medium">Company / role</th>
                  <th className="py-2 pr-3 font-medium">Student</th>
                  <th className="py-2 pr-3 font-medium">Channel</th>
                  <th className="py-2 pr-3 font-medium">Priority</th>
                  <th className="py-2 pr-3 font-medium">Status</th>
                  <th className="py-2 pr-3 font-medium">Assignee</th>
                  <th className="py-2 font-medium">Last activity</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {result.cases.map((item) => (
                  <tr key={item.id} className="align-top">
                    <td className="py-2 pr-3">
                      <Link to={`/staff/cases/${item.id}`} className="font-mono font-medium text-blue-700 hover:underline">
                        {item.caseNumber}
                      </Link>
                      <div className="mt-1 flex flex-wrap gap-1">
                        {item.topSignal && (
                          <span className="rounded bg-red-50 px-1.5 py-0.5 text-xs font-medium text-red-800 ring-1 ring-red-200" title="Top warning signal (automated hint)">
                            {SIGNAL_LABELS[item.topSignal] ?? item.topSignal}
                          </span>
                        )}
                        {item.relatedCount > 0 && (
                          <span className="rounded bg-violet-50 px-1.5 py-0.5 text-xs font-medium text-violet-800 ring-1 ring-violet-200" title="Related cases">
                            {item.relatedCount} related
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="py-2 pr-3">
                      <div className="text-slate-900">{item.claimedCompany}</div>
                      {item.roleTitle && <div className="text-xs text-slate-500">{item.roleTitle}</div>}
                    </td>
                    <td className="py-2 pr-3 text-slate-700">
                      {item.student ? (
                        <>
                          {item.student.name}
                          <div className="text-xs text-slate-500">
                            {item.student.branch}-{item.student.year}
                          </div>
                        </>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="py-2 pr-3 text-slate-700">{CHANNEL_LABELS[item.channel] ?? item.channel}</td>
                    <td className="py-2 pr-3">
                      <PriorityBadge priority={item.priority} />
                    </td>
                    <td className="py-2 pr-3">
                      <StatusBadge status={item.status} audience="staff" />
                    </td>
                    <td className="py-2 pr-3 text-slate-700">{item.assignee?.name ?? 'Unassigned'}</td>
                    <td className="py-2 text-slate-700">
                      {relativeTime(item.lastActivityAt)}
                      {item.isStale && (
                        <span className="ml-2 rounded bg-amber-100 px-1.5 py-0.5 text-xs font-medium text-amber-900" title="No activity recently">
                          Stale
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {result && result.total > PAGE_SIZE && (
          <div className="flex items-center justify-between pt-2 text-sm">
            <Button variant="secondary" disabled={page <= 1} onClick={() => update({ page: page - 1 })}>
              Previous
            </Button>
            <span className="text-slate-600">
              Page {page} of {totalPages} · {result.total} cases
            </span>
            <Button variant="secondary" disabled={page >= totalPages} onClick={() => update({ page: page + 1 })}>
              Next
            </Button>
          </div>
        )}
      </Card>
    </div>
  )
}
