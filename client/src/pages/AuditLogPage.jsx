import { useEffect, useState } from 'react'
import { listAuditEntries } from '../api/audit.js'
import { errorMessage } from '../api/errors.js'
import { ROLE_LABELS } from '../auth/roles.js'
import { FileClock, Filter } from 'lucide-react'
import { Avatar, Badge, Button, Card, EmptyState, ErrorAlert, PageHeader, Pagination, Skeleton, Table, TBody, Td, TextField, Th, THead, Tr } from '../components/ui/index.js'
import { formatDateTime, relativeTime } from '../utils/format.js'
import usePageTitle from '../hooks/usePageTitle.js'

const PAGE_SIZE = 50
const EMPTY = { action: '', entityId: '', from: '', to: '' }

// Action chips are coloured by family so the trail scans quickly (case, indicator, recruiter, advisory, student, staff).
const FAMILY_TONES = { case: 'accent', indicator: 'danger', recruiter: 'success', advisory: 'warning', student: 'info', staff: 'violet', user: 'violet', college: 'brand', evidence: 'neutral', auth: 'neutral' }
const familyTone = (action) => FAMILY_TONES[String(action).split('.')[0]] ?? 'neutral'

const describeMetadata = (metadata) =>
  Object.entries(metadata ?? {})
    .map(([key, value]) => `${key}: ${Array.isArray(value) ? value.join(', ') : value === null ? '—' : value}`)
    .join(' · ')

/** TPO head: the college's append-only audit trail. */
export default function AuditLogPage() {
  usePageTitle('Audit log')
  const [draft, setDraft] = useState(EMPTY)
  const [filters, setFilters] = useState(EMPTY)
  const [page, setPage] = useState(1)
  const [result, setResult] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    const params = { ...filters, page, limit: PAGE_SIZE }
    if (params.to) params.to = `${params.to}T23:59:59.999Z`
    listAuditEntries(params)
      .then((data) => {
        if (!active) return
        setResult(data)
        setError('')
      })
      .catch((err) => active && setError(errorMessage(err, 'Could not load the audit log.')))
    return () => {
      active = false
    }
  }, [filters, page])

  const totalPages = result ? Math.max(1, Math.ceil(result.total / PAGE_SIZE)) : 1
  const update = (field) => (event) => setDraft((current) => ({ ...current, [field]: event.target.value }))

  return (
    <div className="space-y-6">
      <PageHeader title="Audit log" description="Every important action in your college. Entries cannot be edited or deleted." />

      <Card>
        <form
          className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-[repeat(4,minmax(0,1fr))_auto] lg:items-end"
          onSubmit={(event) => {
            event.preventDefault()
            setPage(1)
            setFilters({ ...draft })
          }}
        >
          <TextField label="Action" placeholder="case.decision" value={draft.action} onChange={update('action')} />
          <TextField label="Entity id" value={draft.entityId} onChange={update('entityId')} />
          <TextField label="From" type="date" value={draft.from} onChange={update('from')} />
          <TextField label="To" type="date" value={draft.to} onChange={update('to')} />
          <Button type="submit" icon={Filter}>
            Apply filters
          </Button>
        </form>
      </Card>

      <Card padded={false}>
        <div className="p-5 empty:hidden">
          <ErrorAlert message={error} />
          {!result && !error && <Skeleton rows={5} label="Loading audit log" />}
          {result?.entries.length === 0 && (
            <EmptyState icon={FileClock} title="No entries match.">
              Try a wider date range or clear the filters.
            </EmptyState>
          )}
        </div>
        {result?.entries.length > 0 && (
          <Table label="Audit entries" density="compact">
            <THead>
              <tr>
                <Th>When</Th>
                <Th>Actor</Th>
                <Th>Action</Th>
                <Th>Entity</Th>
                <Th>Details</Th>
              </tr>
            </THead>
            <TBody>
              {result.entries.map((entry) => (
                <Tr key={entry.id}>
                  <Td className="whitespace-nowrap text-slate-600">
                    <time dateTime={entry.createdAt} title={formatDateTime(entry.createdAt)}>
                      {relativeTime(entry.createdAt)}
                    </time>
                  </Td>
                  <Td className="min-w-44">
                    <div className="flex items-center gap-2.5">
                      <Avatar name={entry.actor.name ?? ROLE_LABELS[entry.actor.role] ?? 'System'} size="sm" />
                      <div className="min-w-0">
                        <div className="truncate text-slate-900">{entry.actor.name ?? '—'}</div>
                        <div className="text-xs text-slate-500">{ROLE_LABELS[entry.actor.role] ?? entry.actor.role}</div>
                      </div>
                    </div>
                  </Td>
                  <Td>
                    <Badge tone={familyTone(entry.action)} className="font-mono">
                      {entry.action}
                    </Badge>
                  </Td>
                  <Td className="text-xs text-slate-700">
                    {entry.entity.type}
                    <div className="font-mono text-slate-400">{entry.entity.id}</div>
                  </Td>
                  <Td className="max-w-md break-all text-xs text-slate-600">{describeMetadata(entry.metadata)}</Td>
                </Tr>
              ))}
            </TBody>
          </Table>
        )}
        {result && <Pagination page={page} totalPages={totalPages} onPage={setPage} />}
      </Card>
    </div>
  )
}
