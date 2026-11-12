import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { errorMessage } from '../api/errors.js'
import { approveStudent, bulkApproveStudents, listStudents, rejectStudent, resetUserPassword, setStudentStatus } from '../api/students.js'
import { useAuth } from '../auth/useAuth.js'
import ConfirmDialog from '../components/ConfirmDialog.jsx'
import EmptyState from '../components/EmptyState.jsx'
import Skeleton from '../components/Skeleton.jsx'
import { Button, Card, ErrorAlert, OneTimeSecret, SelectField, TextAreaField, TextField } from '../components/ui.jsx'
import usePageTitle from '../hooks/usePageTitle.js'
import { relativeTime } from '../utils/time.js'

const TABS = [
  { value: 'pending', status: 'pending_approval', label: 'Pending' },
  { value: 'active', status: 'active', label: 'Active' },
  { value: 'disabled', status: 'disabled', label: 'Disabled' },
]

function RejectDialog({ student, onReject, onCancel }) {
  const [reason, setReason] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function confirm() {
    setBusy(true)
    setError('')
    try {
      await onReject(reason.trim())
    } catch (err) {
      setError(errorMessage(err))
      setBusy(false)
    }
  }

  return (
    <ConfirmDialog title={`Reject ${student.name}?`} confirmLabel="Reject" danger busy={busy} onConfirm={confirm} onCancel={onCancel}>
      <p>The student will no longer be able to sign in. Use this for registrations you cannot match to an enrolled student.</p>
      <TextAreaField label="Reason (optional, staff only)" rows={3} maxLength={500} value={reason} onChange={(event) => setReason(event.target.value)} />
      <ErrorAlert message={error} />
    </ConfirmDialog>
  )
}

export default function StaffStudentsPage() {
  usePageTitle('Students')
  const { college } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()
  const tab = TABS.find((item) => item.value === searchParams.get('tab')) ?? (college?.studentVerification === 'manual_approval' ? TABS[0] : TABS[1])
  const [filters, setFilters] = useState({ q: '', year: '', branch: '' })
  const [query, setQuery] = useState({ q: '', year: '', branch: '' })
  const [result, setResult] = useState(null)
  const [loadError, setLoadError] = useState('')
  const [actionError, setActionError] = useState('')
  const [notice, setNotice] = useState('')
  const [selected, setSelected] = useState([])
  const [busyId, setBusyId] = useState(null)
  const [rejecting, setRejecting] = useState(null)
  const [secret, setSecret] = useState(null)
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    let active = true
    const params = { status: tab.status, limit: 100 }
    for (const key of ['q', 'year', 'branch']) if (query[key]) params[key] = query[key]
    listStudents(params)
      .then((data) => {
        if (!active) return
        setResult({ ...data, tab: tab.value })
        setLoadError('')
      })
      .catch((err) => active && setLoadError(errorMessage(err, 'Could not load students.')))
    return () => {
      active = false
    }
  }, [tab.status, tab.value, query, reloadKey])

  const students = result?.tab === tab.value ? result.students : null
  const reload = () => {
    setSelected([])
    setReloadKey((key) => key + 1)
  }

  function chooseTab(value) {
    setSelected([])
    setNotice('')
    setActionError('')
    setSearchParams({ tab: value })
  }

  async function run(id, action, message) {
    setActionError('')
    setNotice('')
    setBusyId(id)
    try {
      const value = await action()
      if (message) setNotice(message(value))
      reload()
      return value
    } catch (err) {
      setActionError(errorMessage(err))
      return null
    } finally {
      setBusyId(null)
    }
  }

  async function resetPassword(student) {
    const value = await run(student.id, () => resetUserPassword(student.id))
    if (value) setSecret({ email: student.email, password: value.temporaryPassword })
  }

  const toggle = (id) => setSelected((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]))

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-bold text-slate-900">Students</h1>
        <p className="text-sm text-slate-600">
          {college?.studentVerification === 'manual_approval'
            ? 'Your college approves each student registration. Check new registrations against your enrolment list.'
            : 'Students register with a college email address and the join code.'}
        </p>
      </div>

      {secret && (
        <OneTimeSecret label={`Temporary password for ${secret.email}`} value={secret.password} onDismiss={() => setSecret(null)} />
      )}

      <div role="tablist" aria-label="Student status" className="flex flex-wrap gap-2">
        {TABS.map((item) => (
          <button
            key={item.value}
            type="button"
            role="tab"
            aria-selected={item.value === tab.value}
            onClick={() => chooseTab(item.value)}
            className={`rounded-full px-4 py-1.5 text-sm font-medium ${
              item.value === tab.value ? 'bg-blue-700 text-white' : 'border border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
            }`}
          >
            {item.label}
            {item.value === 'pending' && result?.pendingCount ? ` (${result.pendingCount})` : ''}
          </button>
        ))}
      </div>

      <Card>
        <form
          className="grid gap-3 sm:grid-cols-[2fr_1fr_1fr_auto] sm:items-end"
          onSubmit={(event) => {
            event.preventDefault()
            setQuery(filters)
          }}
        >
          <TextField label="Search name or email" value={filters.q} onChange={(event) => setFilters((current) => ({ ...current, q: event.target.value }))} />
          <SelectField label="Year" value={filters.year} onChange={(event) => setFilters((current) => ({ ...current, year: event.target.value }))}>
            <option value="">All years</option>
            {[1, 2, 3, 4, 5].map((year) => (
              <option key={year} value={year}>
                Year {year}
              </option>
            ))}
          </SelectField>
          <SelectField label="Branch" value={filters.branch} onChange={(event) => setFilters((current) => ({ ...current, branch: event.target.value }))}>
            <option value="">All branches</option>
            {(college?.branches ?? []).map((branch) => (
              <option key={branch} value={branch}>
                {branch}
              </option>
            ))}
          </SelectField>
          <Button type="submit" variant="secondary">
            Apply
          </Button>
        </form>

        <ErrorAlert message={loadError || actionError} />
        {notice && <p className="text-sm text-emerald-700">{notice}</p>}

        {tab.value === 'pending' && students?.length > 0 && (
          <div className="flex flex-wrap items-center gap-3">
            <Button
              disabled={selected.length === 0 || busyId === 'bulk'}
              onClick={() =>
                run('bulk', () => bulkApproveStudents(selected), (value) => `${value.approved.length} student${value.approved.length === 1 ? '' : 's'} approved.`)
              }
            >
              Approve selected ({selected.length})
            </Button>
            <Button variant="secondary" onClick={() => setSelected(selected.length === students.length ? [] : students.map((student) => student.id))}>
              {selected.length === students.length ? 'Clear selection' : 'Select all'}
            </Button>
          </div>
        )}

        {students === null && !loadError && <Skeleton rows={4} label="Loading students" />}
        {students?.length === 0 && (
          <EmptyState title={tab.value === 'pending' ? 'No students are waiting for approval' : `No ${tab.label.toLowerCase()} students`}>
            {query.q || query.year || query.branch ? 'Try clearing the filters.' : null}
          </EmptyState>
        )}
        {students?.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-200 text-slate-500">
                <tr>
                  {tab.value === 'pending' && <th className="py-2 pr-2 font-medium"><span className="sr-only">Select</span></th>}
                  <th className="py-2 pr-4 font-medium">Name</th>
                  <th className="py-2 pr-4 font-medium">Email</th>
                  <th className="py-2 pr-4 font-medium">Year · Branch</th>
                  <th className="py-2 pr-4 font-medium">Registered</th>
                  <th className="py-2 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {students.map((student) => (
                  <tr key={student.id}>
                    {tab.value === 'pending' && (
                      <td className="py-2 pr-2">
                        <input
                          type="checkbox"
                          aria-label={`Select ${student.name}`}
                          className="h-4 w-4 rounded border-slate-300"
                          checked={selected.includes(student.id)}
                          onChange={() => toggle(student.id)}
                        />
                      </td>
                    )}
                    <td className="py-2 pr-4 text-slate-900">{student.name}</td>
                    <td className="py-2 pr-4 break-all text-slate-700">{student.email}</td>
                    <td className="py-2 pr-4 text-slate-700">
                      {student.year} · {student.branch}
                    </td>
                    <td className="py-2 pr-4 text-slate-600">{relativeTime(student.createdAt)}</td>
                    <td className="py-2">
                      <div className="flex flex-wrap gap-2">
                        {tab.value === 'pending' && (
                          <>
                            <Button
                              disabled={busyId === student.id}
                              onClick={() => run(student.id, () => approveStudent(student.id), () => `${student.name} approved.`)}
                            >
                              Approve
                            </Button>
                            <Button variant="danger" disabled={busyId === student.id} onClick={() => setRejecting(student)}>
                              Reject
                            </Button>
                          </>
                        )}
                        {tab.value !== 'pending' && (
                          <>
                            <Button variant="secondary" disabled={busyId === student.id} onClick={() => resetPassword(student)}>
                              Reset password
                            </Button>
                            <Button
                              variant={student.status === 'active' ? 'danger' : 'secondary'}
                              disabled={busyId === student.id}
                              onClick={() =>
                                run(
                                  student.id,
                                  () => setStudentStatus(student.id, student.status === 'active' ? 'disabled' : 'active'),
                                  (value) => `${student.name} is now ${value.status}.`,
                                )
                              }
                            >
                              {student.status === 'active' ? 'Disable' : 'Enable'}
                            </Button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {rejecting && (
        <RejectDialog
          student={rejecting}
          onCancel={() => setRejecting(null)}
          onReject={async (reason) => {
            await rejectStudent(rejecting.id, reason)
            setRejecting(null)
            setNotice(`${rejecting.name} was rejected.`)
            reload()
          }}
        />
      )}
    </div>
  )
}
