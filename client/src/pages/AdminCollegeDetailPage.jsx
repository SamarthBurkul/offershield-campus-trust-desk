import { Building2, KeyRound, RefreshCcw, Save, UserPlus, Users } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { createTpoHead, getCollege, listCollegeStaff, resetTpoHeadPassword, rotateJoinCode, updateCollege } from '../api/admin.js'
import { errorMessage } from '../api/errors.js'
import { ROLE_LABELS, ROLES } from '../auth/roles.js'
import {
  Avatar,
  Badge,
  Button,
  Card,
  ConfirmDialog,
  EmptyState,
  ErrorAlert,
  OneTimeSecret,
  PageHeader,
  SelectField,
  Skeleton,
  StatusBadge,
  TextField,
  useToast,
} from '../components/ui/index.js'
import usePageTitle from '../hooks/usePageTitle.js'
import { splitList } from '../utils/lists.js'

const toForm = (college) => ({
  name: college.name,
  emailDomains: college.emailDomains.join(', '),
  branches: college.branches.join(', '),
  status: college.status,
  studentVerification: college.studentVerification ?? 'email_domain',
})

const VERIFICATION_LABELS = Object.freeze({
  email_domain: 'College email domain (students self-register)',
  manual_approval: 'Manual approval (any email; staff approve each student)',
})

export default function AdminCollegeDetailPage() {
  usePageTitle('College')
  const { id } = useParams()
  const [college, setCollege] = useState(null)
  const [staff, setStaff] = useState([])
  const [loadError, setLoadError] = useState('')
  const [reloadKey, setReloadKey] = useState(0)
  const [secret, setSecret] = useState(null)
  const [resetError, setResetError] = useState('')

  useEffect(() => {
    let active = true
    Promise.all([getCollege(id), listCollegeStaff(id)])
      .then(([details, members]) => {
        if (!active) return
        setCollege(details)
        setStaff(members)
        setLoadError('')
      })
      .catch((err) => active && setLoadError(errorMessage(err, 'Could not load this college.')))
    return () => {
      active = false
    }
  }, [id, reloadKey])

  if (loadError) {
    return (
      <div className="mx-auto max-w-xl">
        <EmptyState
          icon={Building2}
          as="h1"
          title="College not available"
          action={
            <Link to="/admin" className="text-sm font-medium text-accent-700 hover:text-accent-800">
              Back to colleges
            </Link>
          }
        >
          <span role="alert">{loadError}</span>
        </EmptyState>
      </div>
    )
  }
  if (!college) return <Skeleton rows={4} label="Loading college" />

  async function resetHead(member) {
    setResetError('')
    try {
      const { temporaryPassword } = await resetTpoHeadPassword(member.id)
      setSecret({ email: member.email, password: temporaryPassword })
    } catch (err) {
      setResetError(errorMessage(err))
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        breadcrumb={[{ label: 'Colleges', to: '/admin' }, { label: college.name }]}
        title={college.name}
        description={
          <span className="inline-flex flex-wrap items-center gap-2">
            <span className="font-mono text-slate-500">{college.code}</span>
            <StatusBadge status={college.status} />
            {college.isDemo && <Badge tone="warning">Demo</Badge>}
          </span>
        }
      />

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        {/* Keyed by updatedAt so the form re-reads the saved values; the success message is a toast, so it survives the remount. */}
        <EditCollegeCard key={college.updatedAt} college={college} onSaved={setCollege} />
        <div className="space-y-6">
          <JoinCodeCard collegeId={college.id} />
          <CreateTpoHeadCard college={college} onCreated={() => setReloadKey((key) => key + 1)} />
        </div>
      </div>

      <Card title="Staff" icon={Users} padded={false}>
        <div className="space-y-3 p-5 empty:hidden">
          {secret && <OneTimeSecret label={`Temporary password for ${secret.email}`} value={secret.password} onDismiss={() => setSecret(null)} />}
          <ErrorAlert message={resetError} />
        </div>
        {staff.length === 0 ? (
          <p className="px-5 pb-5 text-sm text-slate-600">No staff accounts yet.</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {staff.map((member) => (
              <li key={member.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3 text-sm">
                <span className="flex min-w-0 items-center gap-3">
                  <Avatar name={member.name} size="sm" />
                  <span className="min-w-0">
                    <span className="block font-medium text-slate-900">{member.name}</span>
                    <span className="block break-all text-xs text-slate-500">{member.email}</span>
                  </span>
                </span>
                <span className="flex items-center gap-2 text-slate-600">
                  <Badge tone={member.role === ROLES.TPO_HEAD ? 'brand' : 'neutral'}>{ROLE_LABELS[member.role]}</Badge>
                  <StatusBadge status={member.status} />
                  {member.role === ROLES.TPO_HEAD && (
                    <Button size="sm" variant="secondary" icon={KeyRound} onClick={() => resetHead(member)}>
                      Reset password
                    </Button>
                  )}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  )
}

function EditCollegeCard({ college, onSaved }) {
  const toast = useToast()
  const [form, setForm] = useState(() => toForm(college))
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const update = (field) => (event) => setForm((current) => ({ ...current, [field]: event.target.value }))

  async function handleSubmit(event) {
    event.preventDefault()
    setError('')
    setSubmitting(true)
    try {
      const updated = await updateCollege(college.id, {
        name: form.name,
        emailDomains: splitList(form.emailDomains),
        branches: splitList(form.branches),
        status: form.status,
        studentVerification: form.studentVerification,
      })
      toast.success('Saved. College details updated.')
      onSaved(updated)
    } catch (err) {
      setError(errorMessage(err))
      setSubmitting(false)
    }
  }

  return (
    <Card title="College details" icon={Building2}>
      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <TextField label="College name" value={form.name} onChange={update('name')} />
          <SelectField label="Status" value={form.status} onChange={update('status')}>
            <option value="active">active</option>
            <option value="suspended">suspended</option>
          </SelectField>
          <TextField label="Email domains" hint="Comma-separated" value={form.emailDomains} onChange={update('emailDomains')} />
          <TextField label="Branches" hint="Comma-separated" value={form.branches} onChange={update('branches')} />
          <SelectField label="Student verification" value={form.studentVerification} onChange={update('studentVerification')} className="sm:col-span-2">
            {Object.entries(VERIFICATION_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </SelectField>
        </div>
        <ErrorAlert message={error} />
        <Button type="submit" icon={Save} loading={submitting}>
          {submitting ? 'Saving…' : 'Save changes'}
        </Button>
      </form>
    </Card>
  )
}

function JoinCodeCard({ collegeId }) {
  const [joinCode, setJoinCode] = useState(null)
  const [error, setError] = useState('')
  const [confirming, setConfirming] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  async function rotate() {
    setError('')
    setSubmitting(true)
    try {
      const result = await rotateJoinCode(collegeId)
      setJoinCode(result.studentJoinCode)
      setConfirming(false)
    } catch (err) {
      setError(errorMessage(err))
      setConfirming(false)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Card title="Student join code" icon={KeyRound}>
      <p className="text-sm text-slate-600">Only a hash of the join code is stored, so it cannot be shown again. Rotate it to issue a new one.</p>
      {joinCode && <OneTimeSecret label="New student join code" value={joinCode} onDismiss={() => setJoinCode(null)} />}
      <ErrorAlert message={error} />
      <Button variant="secondary" icon={RefreshCcw} onClick={() => setConfirming(true)}>
        Rotate join code
      </Button>
      {confirming && (
        <ConfirmDialog title="Rotate the student join code?" confirmLabel="Rotate join code" danger busy={submitting} onConfirm={rotate} onCancel={() => setConfirming(false)}>
          <p>The current code stops working immediately. Share the new code with the placement cell.</p>
        </ConfirmDialog>
      )}
    </Card>
  )
}

function CreateTpoHeadCard({ college, onCreated }) {
  const [form, setForm] = useState({ name: '', email: '' })
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [created, setCreated] = useState(null)

  const update = (field) => (event) => setForm((current) => ({ ...current, [field]: event.target.value }))

  async function handleSubmit(event) {
    event.preventDefault()
    setError('')
    setSubmitting(true)
    try {
      setCreated(await createTpoHead(college.id, form))
      setForm({ name: '', email: '' })
      onCreated()
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Card title="Add a TPO head" icon={UserPlus}>
      {created && <OneTimeSecret label={`Temporary password for ${created.user.email}`} value={created.temporaryPassword} onDismiss={() => setCreated(null)} />}
      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        <TextField label="TPO head name" required value={form.name} onChange={update('name')} />
        <TextField label="TPO head email" type="email" required hint={`Must use ${college.emailDomains.join(' or ')}`} value={form.email} onChange={update('email')} />
        <ErrorAlert message={error} />
        <Button type="submit" icon={UserPlus} loading={submitting}>
          {submitting ? 'Creating…' : 'Create TPO head'}
        </Button>
      </form>
    </Card>
  )
}
