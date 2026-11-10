import { useEffect, useState } from 'react'
import { listAuditEntries } from '../api/audit.js'
import { errorMessage } from '../api/errors.js'
import { ROLE_LABELS } from '../auth/roles.js'
import { Button, Card, ErrorAlert, TextField } from '../components/ui.jsx'

const PAGE_SIZE = 50
const EMPTY = { action: '', entityId: '', from: '', to: '' }

const describeMetadata = (metadata) =>
  Object.entries(metadata ?? {})
    .map(([key, value]) => `${key}: ${Array.isArray(value) ? value.join(', ') : value === null ? '—' : value}`)
    .join(' · ')

/** TPO head: the college's append-only audit trail. */
export default function AuditLogPage() {
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
      <div className="space-y-1">
        <h1 className="text-2xl font-bold text-slate-900">Audit log</h1>
        <p className="text-sm text-slate-600">Every important action in your college. Entries cannot be edited or deleted.</p>
      </div>

      <Card>
        <form
          className="grid gap-4 sm:grid-cols-5 sm:items-end"
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
          <Button type="submit">Apply filters</Button>
        </form>
      </Card>

      <Card>
        <ErrorAlert message={error} />
        {!result && !error && <p className="text-slate-600">Loading…</p>}
        {result?.entries.length === 0 && <p className="text-slate-600">No entries match.</p>}
        {result?.entries.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-200 text-slate-500">
                <tr>
                  <th className="py-2 pr-3 font-medium">When</th>
                  <th className="py-2 pr-3 font-medium">Actor</th>
                  <th className="py-2 pr-3 font-medium">Action</th>
                  <th className="py-2 pr-3 font-medium">Entity</th>
                  <th className="py-2 font-medium">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {result.entries.map((entry) => (
                  <tr key={entry.id} className="align-top">
                    <td className="whitespace-nowrap py-2 pr-3 text-slate-700">{new Date(entry.createdAt).toLocaleString()}</td>
                    <td className="py-2 pr-3 text-slate-900">
                      {entry.actor.name ?? '—'}
                      <div className="text-xs text-slate-500">{ROLE_LABELS[entry.actor.role] ?? entry.actor.role}</div>
                    </td>
                    <td className="py-2 pr-3 font-mono text-xs text-slate-900">{entry.action}</td>
                    <td className="py-2 pr-3 text-xs text-slate-700">
                      {entry.entity.type}
                      <div className="font-mono text-slate-500">{entry.entity.id}</div>
                    </td>
                    <td className="break-all py-2 text-xs text-slate-700">{describeMetadata(entry.metadata)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {result && result.total > PAGE_SIZE && (
          <div className="flex items-center justify-between pt-2 text-sm">
            <Button variant="secondary" disabled={page <= 1} onClick={() => setPage(page - 1)}>
              Previous
            </Button>
            <span className="text-slate-600">
              Page {page} of {totalPages}
            </span>
            <Button variant="secondary" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>
              Next
            </Button>
          </div>
        )}
      </Card>
    </div>
  )
}
