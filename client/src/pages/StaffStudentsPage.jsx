import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { errorMessage } from '../api/errors.js'
import { approveStudent, bulkApproveStudents, listStudents, promoteYear, rejectStudent, resetUserPassword, setStudentStatus } from '../api/students.js'
import { ROLES } from '../auth/roles.js'
import { useAuth } from '../auth/useAuth.js'
import ConfirmDialog from '../components/ConfirmDialog.jsx'
import { ArrowUpCircle, Check, CheckCheck, Filter, Hourglass, KeyRound, UserCheck, UserX, Users, X } from 'lucide-react'
import { useNavCounts } from '../components/layout/navCountsContext.js'
import { Avatar, Badge, Button, EmptyState, ErrorAlert, OneTimeSecret, PageHeader, SelectField, Skeleton, Table, Tabs, TBody, Td, TextAreaField, TextField, Th, THead, Tr, useToast, Card } from '../components/ui/index.js'
import usePageTitle from '../hooks/usePageTitle.js'
import { formatDateTime, relativeTime } from '../utils/format.js'

const TABS = [
  { value: 'pending', status: 'pending_approval', label: 'Pending', icon: Hourglass },
  { value: 'active', status: 'active', label: 'Active', icon: UserCheck },
  { value: 'disabled', status: 'disabled', label: 'Disabled', icon: UserX },
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

/**
 * TPO head: academic-year upkeep. Shows how many active students are in the chosen year before
 * moving them all up one year (run once after results each June, final year first).
 */
function PromoteYearDialog({ onCancel, onDone }) {
  const [fromYear, setFromYear] = useState('4')
  // The count belongs to the year it was fetched for, so a stale count is never shown.
  const [counted, setCounted] = useState({ year: null, total: 0 })
  const count = counted.year === fromYear ? counted.total : null
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let active = true
    Promise.resolve()
      .then(() => listStudents({ status: 'active', year: Number(fromYear), limit: 1 }))
      .then((data) => active && setCounted({ year: fromYear, total: data?.total ?? 0 }))
      .catch(() => active && setCounted({ year: fromYear, total: 0 }))
    return () => {
      active = false
    }
  }, [fromYear])

  async function confirm() {
    if (count === null) return
    setBusy(true)
    setError('')
    try {
      onDone(await promoteYear(Number(fromYear)))
    } catch (err) {
      setError(errorMessage(err))
      setBusy(false)
    }
  }

  const to = Number(fromYear) + 1
  return (
    <ConfirmDialog title="Promote students to the next year" confirmLabel={`Promote to year ${to}`} busy={busy} onConfirm={confirm} onCancel={onCancel}>
      <ErrorAlert message={error} />
      <SelectField label="Students now in" value={fromYear} onChange={(event) => setFromYear(event.target.value)}>
        {[4, 3, 2, 1].map((year) => (
          <option key={year} value={year}>
            Year {year}
          </option>
        ))}
      </SelectField>
      <p className="text-sm text-slate-700">
        {count === null ? 'Counting students…' : `${count} active student${count === 1 ? '' : 's'} in year ${fromYear} will move to year ${to}.`}
      </p>
      <p className="text-xs text-slate-500">Run after results each June, starting with the final year so nobody is promoted twice.</p>
    </ConfirmDialog>
  )
}

export default function StaffStudentsPage() {
  usePageTitle('Students')
  const { college, user } = useAuth()
  const isHead = user?.role === ROLES.TPO_HEAD
  const [promoting, setPromoting] = useState(false)
  const [searchParams, setSearchParams] = useSearchParams()
  const tab = TABS.find((item) => item.value === searchParams.get('tab')) ?? (college?.studentVerification === 'manual_approval' ? TABS[0] : TABS[1])
  const [filters, setFilters] = useState({ q: '', year: '', branch: '' })
  const [query, setQuery] = useState({ q: '', year: '', branch: '' })
  const [result, setResult] = useState(null)
  const [loadError, setLoadError] = useState('')
  const [actionError, setActionError] = useState('')
  const toast = useToast()
  const { publish } = useNavCounts()
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
        publish({ pendingStudents: data.pendingCount })
      })
      .catch((err) => active && setLoadError(errorMessage(err, 'Could not load students.')))
    return () => {
      active = false
    }
  }, [tab.status, tab.value, query, reloadKey, publish])

  const students = result?.tab === tab.value ? result.students : null
  const reload = () => {
    setSelected([])
    setReloadKey((key) => key + 1)
  }

  function chooseTab(value) {
    setSelected([])
    setActionError('')
    setSearchParams({ tab: value })
  }

  async function run(id, action, message) {
    setActionError('')
    setBusyId(id)
    try {
      const value = await action()
      if (message) toast.success(message(value))
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
      <PageHeader
        title="Students"
        description={
          college?.studentVerification === 'manual_approval'
            ? 'Your college approves each student registration. Check new registrations against your enrolment list.'
            : 'Students register with a college email address and the join code.'
        }
        actions={
          isHead && (
            <Button variant="secondary" icon={ArrowUpCircle} onClick={() => setPromoting(true)}>
              Promote year
            </Button>
          )
        }
      />

      {secret && <OneTimeSecret label={`Temporary password for ${secret.email}`} value={secret.password} onDismiss={() => setSecret(null)} />}

      <Card padded={false}>
        <div className="px-5 pt-2">
          <Tabs
            label="Student status"
            value={tab.value}
            onChange={chooseTab}
            tabs={TABS.map((item) => ({ value: item.value, label: item.label, icon: item.icon, count: item.value === 'pending' && result?.pendingCount ? result.pendingCount : undefined }))}
          />
        </div>
        <form
          className="grid grid-cols-1 gap-3 border-b border-slate-100 px-5 py-4 sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)_auto] sm:items-end"
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
          <Button type="submit" variant="secondary" icon={Filter}>
            Apply
          </Button>
        </form>

        <div className="space-y-4 p-5 empty:hidden">
          <ErrorAlert message={loadError || actionError} />
          {tab.value === 'pending' && students?.length > 0 && (
            <div className="flex flex-wrap items-center gap-3 rounded-xl bg-slate-50 px-3 py-2.5 ring-1 ring-inset ring-slate-200">
              <Button
                size="sm"
                variant="success"
                icon={CheckCheck}
                disabled={selected.length === 0}
                loading={busyId === 'bulk'}
                onClick={() =>
                  run('bulk', () => bulkApproveStudents(selected), (value) => `${value.approved.length} student${value.approved.length === 1 ? '' : 's'} approved.`)
                }
              >
                Approve selected ({selected.length})
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setSelected(selected.length === students.length ? [] : students.map((student) => student.id))}>
                {selected.length === students.length ? 'Clear selection' : 'Select all'}
              </Button>
            </div>
          )}
          {students === null && !loadError && <Skeleton rows={4} label="Loading students" />}
          {students?.length === 0 && (
            <EmptyState icon={Users} title={tab.value === 'pending' ? 'No students are waiting for approval' : `No ${tab.label.toLowerCase()} students`}>
              {query.q || query.year || query.branch ? 'Try clearing the filters.' : null}
            </EmptyState>
          )}
        </div>
        {students?.length > 0 && (
          <Table label="Students">
            <THead>
              <tr>
                {tab.value === 'pending' && (
                  <Th className="w-10">
                    <span className="sr-only">Select</span>
                  </Th>
                )}
                <Th>Student</Th>
                <Th>Year · Branch</Th>
                <Th>Sign-in</Th>
                <Th>Registered</Th>
                <Th className="text-right">Actions</Th>
              </tr>
            </THead>
            <TBody>
              {students.map((student) => (
                <Tr key={student.id}>
                  {tab.value === 'pending' && (
                    <Td>
                      <input
                        type="checkbox"
                        aria-label={`Select ${student.name}`}
                        className="h-4 w-4 cursor-pointer rounded accent-accent-600"
                        checked={selected.includes(student.id)}
                        onChange={() => toggle(student.id)}
                      />
                    </Td>
                  )}
                  <Td className="min-w-56">
                    <div className="flex items-center gap-3">
                      <Avatar name={student.name} size="sm" />
                      <div className="min-w-0">
                        <div className="font-medium text-slate-900">{student.name}</div>
                        <div className="break-all text-xs text-slate-500">{student.email}</div>
                      </div>
                    </div>
                  </Td>
                  <Td className="whitespace-nowrap text-slate-700">
                    {student.year} · {student.branch}
                  </Td>
                  <Td>
                    <div className="flex flex-wrap gap-1.5">
                      {student.emailVerified === false ? <Badge tone="warning">Email not verified</Badge> : <Badge tone="info">Verified email</Badge>}
                      <Badge>{(student.authMethods ?? ['password']).includes('google') ? 'Google' : 'Password'}</Badge>
                    </div>
                  </Td>
                  <Td className="whitespace-nowrap text-slate-600">
                    <span title={formatDateTime(student.createdAt)}>{relativeTime(student.createdAt)}</span>
                  </Td>
                  <Td className="text-right">
                    <div className="inline-flex flex-wrap justify-end gap-2">
                      {tab.value === 'pending' && (
                        <>
                          <Button
                            size="sm"
                            variant="success"
                            icon={Check}
                            disabled={busyId === student.id || student.emailVerified === false}
                            title={student.emailVerified === false ? 'The student must verify their email address first' : undefined}
                            onClick={() => run(student.id, () => approveStudent(student.id), () => `${student.name} approved.`)}
                          >
                            Approve
                          </Button>
                          <Button size="sm" variant="secondary" icon={X} disabled={busyId === student.id} onClick={() => setRejecting(student)}>
                            Reject
                          </Button>
                        </>
                      )}
                      {tab.value !== 'pending' && (
                        <>
                          <Button size="sm" variant="secondary" icon={KeyRound} disabled={busyId === student.id} onClick={() => resetPassword(student)}>
                            Reset password
                          </Button>
                          <Button
                            size="sm"
                            variant={student.status === 'active' ? 'secondary' : 'success'}
                            icon={student.status === 'active' ? UserX : UserCheck}
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
                  </Td>
                </Tr>
              ))}
            </TBody>
          </Table>
        )}
      </Card>

      {promoting && (
        <PromoteYearDialog
          onCancel={() => setPromoting(false)}
          onDone={(value) => {
            setPromoting(false)
            toast.success(`${value.promoted} student${value.promoted === 1 ? '' : 's'} moved from year ${value.fromYear} to year ${value.toYear}.`)
            reload()
          }}
        />
      )}

      {rejecting && (
        <RejectDialog
          student={rejecting}
          onCancel={() => setRejecting(null)}
          onReject={async (reason) => {
            await rejectStudent(rejecting.id, reason)
            setRejecting(null)
            toast.success(`${rejecting.name} was rejected.`)
            reload()
          }}
        />
      )}
    </div>
  )
}
