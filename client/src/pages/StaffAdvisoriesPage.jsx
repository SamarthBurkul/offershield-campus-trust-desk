import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { listStaffAdvisories } from '../api/advisories.js'
import { errorMessage } from '../api/errors.js'
import { AlertTriangle, FilePen, Megaphone, Plus, Send, Undo2, Users } from 'lucide-react'
import { Badge, ButtonLink, Card, EmptyState, ErrorAlert, PageHeader, ProgressBar, Skeleton, Tabs } from '../components/ui/index.js'
import { formatDate } from '../utils/format.js'
import usePageTitle from '../hooks/usePageTitle.js'

const TABS = [
  { value: 'draft', label: 'Drafts', icon: FilePen },
  { value: 'published', label: 'Published', icon: Send },
  { value: 'withdrawn', label: 'Withdrawn', icon: Undo2 },
]
const SEVERITY = {
  critical: { tone: 'danger', stripe: 'bg-rose-500' },
  warning: { tone: 'warning', stripe: 'bg-amber-500' },
  info: { tone: 'info', stripe: 'bg-sky-500' },
}

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
      <PageHeader
        title="Advisories"
        description="Warnings for the batches at risk, built from confirmed findings. Officers draft; the TPO head publishes."
        actions={
          <ButtonLink to="/staff/advisories/new" icon={Plus}>
            New advisory
          </ButtonLink>
        }
      />
      <Card padded={false}>
        <div className="px-5 pt-2">
          <Tabs label="Advisory status" value={status} onChange={setStatus} tabs={TABS} />
        </div>
        <div className="space-y-4 p-5">
          <ErrorAlert message={error} />
          {(!result || result.status !== status) && !error && <Skeleton rows={3} label="Loading advisories" />}
          {result?.status === status && result.advisories.length === 0 && (
            <EmptyState icon={Megaphone} title={`No ${TABS.find((tab) => tab.value === status).label.toLowerCase()} yet`}>
              Draft an advisory from a confirmed fraud case, or start a new one.
            </EmptyState>
          )}
          {result?.status === status && result.advisories.length > 0 && (
            <ul className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              {result.advisories.map((advisory) => {
                const severity = SEVERITY[advisory.severity] ?? SEVERITY.info
                return (
                  <li key={advisory.id} className="relative overflow-hidden rounded-2xl bg-white shadow-card ring-1 ring-slate-900/5 transition hover:shadow-raised">
                    <span className={`absolute inset-y-0 left-0 w-1.5 ${severity.stripe}`} aria-hidden="true" />
                    <div className="space-y-3 py-4 pl-6 pr-5">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <Link to={`/staff/advisories/${advisory.id}`} className="min-w-0 font-semibold text-slate-900 hover:text-accent-800 hover:underline">
                          {advisory.title}
                        </Link>
                        <div className="flex flex-wrap gap-1.5">
                          {advisory.needsReview && (
                            <Badge tone="warning" icon={AlertTriangle}>
                              Needs review
                            </Badge>
                          )}
                          <Badge tone={severity.tone}>{advisory.severity}</Badge>
                        </div>
                      </div>
                      <p className="flex items-center gap-1.5 text-xs text-slate-500">
                        <Users className="h-3.5 w-3.5" aria-hidden="true" />
                        {advisory.target.years.length ? `Years ${advisory.target.years.join(', ')}` : 'All years'} ·{' '}
                        {advisory.target.branches.length ? advisory.target.branches.join(', ') : 'All branches'}
                        {advisory.publishedAt && <> · published {formatDate(advisory.publishedAt)}</>}
                      </p>
                      {advisory.status === 'published' && (
                        <div className="space-y-1.5">
                          <div className="flex items-center justify-between text-xs text-slate-600">
                            <span>Acknowledged</span>
                            <span className="font-medium tabular-nums text-slate-900">
                              {Math.round(advisory.ackRate * 100)}% ({advisory.acknowledgedCount}/{advisory.audienceCount ?? 0})
                            </span>
                          </div>
                          <ProgressBar value={advisory.ackRate} label={`Acknowledgements for ${advisory.title}`} tone="success" />
                        </div>
                      )}
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      </Card>
    </div>
  )
}
