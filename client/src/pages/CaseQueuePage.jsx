import { Inbox, Link2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { errorMessage } from '../api/errors.js'
import { getCaseCounts, listStaffCases } from '../api/staffCases.js'
import CaseFilters from '../components/CaseFilters.jsx'
import { CHANNEL_ICONS } from '../components/channelIcons.js'
import { useNavCounts } from '../components/layout/navCountsContext.js'
import StatusBadge from '../components/StatusBadge.jsx'
import { Avatar, Badge, Card, EmptyState, ErrorAlert, PageHeader, Pagination, Skeleton, Table, TBody, Td, Th, THead, Tr } from '../components/ui/index.js'
import { CHANNEL_LABELS } from '../constants/caseStatus.js'
import { SIGNAL_LABELS } from '../constants/verificationMethods.js'
import usePageTitle from '../hooks/usePageTitle.js'
import { formatDateTime, relativeTime } from '../utils/format.js'

const FILTER_KEYS = ['status', 'priority', 'assignee', 'channel', 'q', 'page']
const PAGE_SIZE = 20

const EMPTY_COPY = {
  open: 'No open cases match these filters.',
  submitted: 'No new requests are waiting.',
  under_review: 'Nothing is under review right now.',
  awaiting_student: 'No case is waiting for a student reply.',
  closed: 'No closed cases match these filters.',
}

export default function CaseQueuePage() {
  usePageTitle('Case desk')
  const navigate = useNavigate()
  const { publish } = useNavCounts()
  const [searchParams, setSearchParams] = useSearchParams()
  const values = Object.fromEntries(FILTER_KEYS.map((name) => [name, searchParams.get(name) ?? '']))
  const page = Number(values.page) || 1
  const status = values.status || 'open'
  const paramsKey = searchParams.toString()
  const [result, setResult] = useState(null)
  const [counts, setCounts] = useState(null)
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

  // Tab counts from the existing counts endpoint (optional: the tabs work without them).
  useEffect(() => {
    let active = true
    Promise.resolve()
      .then(() => getCaseCounts())
      .then((value) => {
        if (!active || !value) return
        setCounts(value)
        publish({ open: value.open })
      })
      .catch(() => {})
    return () => {
      active = false
    }
  }, [publish])

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
      <PageHeader title="Case desk" description="Every verification request from your college. Click a row to open the case." />

      <Card>
        <CaseFilters key={values.q} values={values} onChange={update} counts={counts} />
      </Card>

      <Card padded={false}>
        <div className="p-5 empty:hidden">
          <ErrorAlert message={error} />
          {!result && !error && <Skeleton rows={5} label="Loading cases" />}
          {result?.cases.length === 0 && (
            <EmptyState icon={Inbox} title={EMPTY_COPY[status] ?? 'No cases match these filters.'}>
              Try another tab or clear the search.
            </EmptyState>
          )}
        </div>
        {result?.cases.length > 0 && (
          <Table label="Cases">
            <THead>
              <tr>
                <Th>Case</Th>
                <Th>Company / role</Th>
                <Th>Student</Th>
                <Th>Channel</Th>
                <Th>Priority</Th>
                <Th>Status</Th>
                <Th>Assignee</Th>
                <Th>Signals</Th>
                <Th>Last activity</Th>
              </tr>
            </THead>
            <TBody>
              {result.cases.map((item) => {
                const ChannelIcon = CHANNEL_ICONS[item.channel] ?? CHANNEL_ICONS.other
                return (
                  <Tr key={item.id} onActivate={() => navigate(`/staff/cases/${item.id}`)}>
                    <Td className="whitespace-nowrap">
                      <Link to={`/staff/cases/${item.id}`} className="font-mono text-[13px] font-semibold text-accent-700 hover:text-accent-800 hover:underline">
                        {item.caseNumber}
                      </Link>
                    </Td>
                    <Td className="min-w-48">
                      <div className="font-medium text-slate-900">{item.claimedCompany}</div>
                      {item.roleTitle && <div className="text-xs text-slate-500">{item.roleTitle}</div>}
                    </Td>
                    <Td className="min-w-44">
                      {item.student ? (
                        <div className="flex items-center gap-2.5">
                          <Avatar name={item.student.name} size="sm" />
                          <div className="min-w-0">
                            <div className="truncate text-slate-800">{item.student.name}</div>
                            <div className="text-xs text-slate-500">
                              {item.student.branch}-{item.student.year}
                            </div>
                          </div>
                        </div>
                      ) : (
                        '—'
                      )}
                    </Td>
                    <Td>
                      <span className="inline-flex items-center gap-1.5 whitespace-nowrap text-slate-600">
                        <ChannelIcon className="h-4 w-4 text-slate-400" aria-hidden="true" />
                        {CHANNEL_LABELS[item.channel] ?? item.channel}
                      </span>
                    </Td>
                    <Td>
                      {item.priority === 'high' ? (
                        <Badge tone="danger" dot>
                          High
                        </Badge>
                      ) : (
                        <span className="text-xs text-slate-500">Normal</span>
                      )}
                    </Td>
                    <Td>
                      <StatusBadge status={item.status} audience="staff" />
                    </Td>
                    <Td className="whitespace-nowrap">
                      {item.assignee ? (
                        <span className="inline-flex items-center gap-2 text-slate-700">
                          <Avatar name={item.assignee.name} size="xs" />
                          {item.assignee.name}
                        </span>
                      ) : (
                        <span className="text-slate-400">Unassigned</span>
                      )}
                    </Td>
                    <Td>
                      <div className="flex flex-wrap gap-1">
                        {item.topSignal && (
                          <Badge tone="danger" size="sm" title="Top warning signal (automated hint)">
                            {SIGNAL_LABELS[item.topSignal] ?? item.topSignal}
                          </Badge>
                        )}
                        {item.relatedCount > 0 && (
                          <Badge tone="violet" size="sm" icon={Link2} title="Related cases">
                            {item.relatedCount} related
                          </Badge>
                        )}
                      </div>
                    </Td>
                    <Td className="whitespace-nowrap text-slate-600">
                      <span title={formatDateTime(item.lastActivityAt)}>{relativeTime(item.lastActivityAt)}</span>
                      {item.isStale && (
                        <Badge tone="warning" size="sm" className="ml-2" title="No activity recently">
                          Stale
                        </Badge>
                      )}
                    </Td>
                  </Tr>
                )
              })}
            </TBody>
          </Table>
        )}
        {result && <Pagination page={page} totalPages={totalPages} summary={`${result.total} cases`} onPage={(next) => update({ page: next })} />}
      </Card>
    </div>
  )
}
