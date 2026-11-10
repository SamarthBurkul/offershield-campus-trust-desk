import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { createCollege, listColleges } from '../api/admin.js'
import { errorMessage } from '../api/errors.js'
import { Button, Card, ErrorAlert, OneTimeSecret, StatusBadge, TextField } from '../components/ui.jsx'
import { splitList } from '../utils/lists.js'

export default function AdminCollegesPage() {
  const [colleges, setColleges] = useState(null)
  const [loadError, setLoadError] = useState('')
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    let active = true
    listColleges()
      .then((list) => {
        if (!active) return
        setColleges(list)
        setLoadError('')
      })
      .catch((err) => active && setLoadError(errorMessage(err, 'Could not load colleges.')))
    return () => {
      active = false
    }
  }, [reloadKey])

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-slate-900">Colleges</h1>
      <CreateCollegeCard onCreated={() => setReloadKey((key) => key + 1)} />
      <Card title="All colleges">
        <ErrorAlert message={loadError} />
        {colleges === null && !loadError && <p className="text-slate-600">Loading…</p>}
        {colleges?.length === 0 && <p className="text-slate-600">No colleges yet.</p>}
        {colleges?.length > 0 && (
          <ul className="divide-y divide-slate-100">
            {colleges.map((college) => (
              <li key={college.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
                <div>
                  <Link to={`/admin/colleges/${college.id}`} className="font-medium text-blue-700 hover:underline">
                    {college.name}
                  </Link>
                  <p className="text-sm text-slate-500">
                    {college.code} · {college.emailDomains.join(', ')} · {college.staffCount} staff
                  </p>
                </div>
                <StatusBadge status={college.status} />
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  )
}

function CreateCollegeCard({ onCreated }) {
  const [form, setForm] = useState({ name: '', code: '', emailDomains: '', branches: '' })
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [created, setCreated] = useState(null)

  const update = (field) => (event) => setForm((current) => ({ ...current, [field]: event.target.value }))

  async function handleSubmit(event) {
    event.preventDefault()
    setError('')
    setSubmitting(true)
    try {
      const details = { name: form.name, code: form.code, emailDomains: splitList(form.emailDomains) }
      const branches = splitList(form.branches)
      if (branches.length > 0) details.branches = branches
      setCreated(await createCollege(details))
      setForm({ name: '', code: '', emailDomains: '', branches: '' })
      onCreated()
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Card title="Onboard a college">
      {created && (
        <OneTimeSecret
          label={`Student join code for ${created.college.name}`}
          value={created.studentJoinCode}
          onDismiss={() => setCreated(null)}
        />
      )}
      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField label="College name" required value={form.name} onChange={update('name')} />
          <TextField label="College code" required hint="Lowercase slug, 3–20 characters, e.g. vjti-mumbai." value={form.code} onChange={update('code')} />
          <TextField label="Email domains" required hint="Comma-separated, e.g. college.edu" value={form.emailDomains} onChange={update('emailDomains')} />
          <TextField label="Branches (optional)" hint="Comma-separated; defaults to COMP, IT, EXTC, MECH, CIVIL, AIDS." value={form.branches} onChange={update('branches')} />
        </div>
        <ErrorAlert message={error} />
        <Button type="submit" disabled={submitting}>
          {submitting ? 'Creating…' : 'Create college'}
        </Button>
      </form>
    </Card>
  )
}
