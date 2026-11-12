import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { createTpoHead, getCollege, listCollegeStaff, resetTpoHeadPassword, rotateJoinCode, updateCollege } from '../api/admin.js'
import { errorMessage } from '../api/errors.js'
import { ROLE_LABELS, ROLES } from '../auth/roles.js'
import { Button, Card, ErrorAlert, OneTimeSecret, SelectField, StatusBadge, TextField } from '../components/ui.jsx'
import { splitList } from '../utils/lists.js'
import Skeleton from '../components/Skeleton.jsx'

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
      <div className="space-y-4">
        <ErrorAlert message={loadError} />
        <Link to="/admin" className="font-medium text-blue-700 hover:underline">
          Back to colleges
        </Link>
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
      <div className="space-y-1">
        <Link to="/admin" className="text-sm font-medium text-blue-700 hover:underline">
          ← All colleges
        </Link>
        <h1 className="text-2xl font-bold text-slate-900">{college.name}</h1>
        <p className="text-slate-600">
          {college.code} · <StatusBadge status={college.status} />
        </p>
      </div>

      <EditCollegeCard key={college.updatedAt} college={college} onSaved={setCollege} />
      <JoinCodeCard collegeId={college.id} />
      <CreateTpoHeadCard college={college} onCreated={() => setReloadKey((key) => key + 1)} />

      <Card title="Staff">
        {secret && (
          <OneTimeSecret label={`Temporary password for ${secret.email}`} value={secret.password} onDismiss={() => setSecret(null)} />
        )}
        <ErrorAlert message={resetError} />
        {staff.length === 0 ? (
          <p className="text-slate-600">No staff accounts yet.</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {staff.map((member) => (
              <li key={member.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
                <span className="text-slate-900">
                  {member.name} <span className="text-slate-500">· {member.email}</span>
                </span>
                <span className="flex items-center gap-2 text-slate-600">
                  {ROLE_LABELS[member.role]} <StatusBadge status={member.status} />
                  {member.role === ROLES.TPO_HEAD && (
                    <Button variant="secondary" onClick={() => resetHead(member)}>
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
  const [form, setForm] = useState(() => toForm(college))
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const update = (field) => (event) => setForm((current) => ({ ...current, [field]: event.target.value }))

  async function handleSubmit(event) {
    event.preventDefault()
    setError('')
    setSaved(false)
    setSubmitting(true)
    try {
      const updated = await updateCollege(college.id, {
        name: form.name,
        emailDomains: splitList(form.emailDomains),
        branches: splitList(form.branches),
        status: form.status,
        studentVerification: form.studentVerification,
      })
      setSaved(true)
      onSaved(updated)
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Card title="College details">
      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField label="College name" value={form.name} onChange={update('name')} />
          <SelectField label="Status" value={form.status} onChange={update('status')}>
            <option value="active">active</option>
            <option value="suspended">suspended</option>
          </SelectField>
          <TextField label="Email domains" hint="Comma-separated" value={form.emailDomains} onChange={update('emailDomains')} />
          <TextField label="Branches" hint="Comma-separated" value={form.branches} onChange={update('branches')} />
          <SelectField label="Student verification" value={form.studentVerification} onChange={update('studentVerification')}>
            {Object.entries(VERIFICATION_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </SelectField>
        </div>
        <ErrorAlert message={error} />
        {saved && <p className="text-sm text-emerald-700">Saved.</p>}
        <Button type="submit" disabled={submitting}>
          {submitting ? 'Saving…' : 'Save changes'}
        </Button>
      </form>
    </Card>
  )
}

function JoinCodeCard({ collegeId }) {
  const [joinCode, setJoinCode] = useState(null)
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  async function rotate() {
    if (!window.confirm('Rotate the student join code? The current code stops working immediately.')) return
    setError('')
    setSubmitting(true)
    try {
      const result = await rotateJoinCode(collegeId)
      setJoinCode(result.studentJoinCode)
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Card title="Student join code">
      <p className="text-sm text-slate-600">
        Only a hash of the join code is stored, so it cannot be shown again. Rotate it to issue a new one.
      </p>
      {joinCode && <OneTimeSecret label="New student join code" value={joinCode} onDismiss={() => setJoinCode(null)} />}
      <ErrorAlert message={error} />
      <Button variant="secondary" disabled={submitting} onClick={rotate}>
        {submitting ? 'Rotating…' : 'Rotate join code'}
      </Button>
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
    <Card title="Add a TPO head">
      {created && (
        <OneTimeSecret
          label={`Temporary password for ${created.user.email}`}
          value={created.temporaryPassword}
          onDismiss={() => setCreated(null)}
        />
      )}
      <form onSubmit={handleSubmit} className="grid gap-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end" noValidate>
        <TextField label="TPO head name" required value={form.name} onChange={update('name')} />
        <TextField
          label="TPO head email"
          type="email"
          required
          hint={`Must use ${college.emailDomains.join(' or ')}`}
          value={form.email}
          onChange={update('email')}
        />
        <Button type="submit" disabled={submitting}>
          {submitting ? 'Creating…' : 'Create TPO head'}
        </Button>
      </form>
      <ErrorAlert message={error} />
    </Card>
  )
}
