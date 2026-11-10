import { useEffect, useState } from 'react'
import { errorMessage } from '../api/errors.js'
import { createOfficer, listStaffMembers, setOfficerStatus } from '../api/staff.js'
import { ROLE_LABELS, ROLES } from '../auth/roles.js'
import { useAuth } from '../auth/useAuth.js'
import { Button, Card, ErrorAlert, OneTimeSecret, StatusBadge, TextField } from '../components/ui.jsx'

export default function StaffMembersPage() {
  const { user } = useAuth()
  const canManage = user.role === ROLES.TPO_HEAD
  const [members, setMembers] = useState(null)
  const [loadError, setLoadError] = useState('')
  const [actionError, setActionError] = useState('')
  const [busyId, setBusyId] = useState(null)
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    let active = true
    listStaffMembers()
      .then((staff) => {
        if (!active) return
        setMembers(staff)
        setLoadError('')
      })
      .catch((err) => active && setLoadError(errorMessage(err, 'Could not load staff members.')))
    return () => {
      active = false
    }
  }, [reloadKey])

  async function toggleStatus(member) {
    setActionError('')
    setBusyId(member.id)
    try {
      const updated = await setOfficerStatus(member.id, member.status === 'active' ? 'disabled' : 'active')
      setMembers((current) => current.map((item) => (item.id === updated.id ? updated : item)))
    } catch (err) {
      setActionError(errorMessage(err))
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-slate-900">Staff members</h1>

      {canManage && <CreateOfficerCard onCreated={() => setReloadKey((key) => key + 1)} />}

      <Card title="Your college's staff">
        <ErrorAlert message={loadError || actionError} />
        {members === null && !loadError && <p className="text-slate-600">Loading…</p>}
        {members && (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-200 text-slate-500">
                <tr>
                  <th className="py-2 pr-4 font-medium">Name</th>
                  <th className="py-2 pr-4 font-medium">Email</th>
                  <th className="py-2 pr-4 font-medium">Role</th>
                  <th className="py-2 pr-4 font-medium">Status</th>
                  {canManage && <th className="py-2 font-medium">Actions</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {members.map((member) => (
                  <tr key={member.id}>
                    <td className="py-2 pr-4 text-slate-900">{member.name}</td>
                    <td className="py-2 pr-4 text-slate-700">{member.email}</td>
                    <td className="py-2 pr-4 text-slate-700">{ROLE_LABELS[member.role]}</td>
                    <td className="py-2 pr-4">
                      <StatusBadge status={member.status} />
                    </td>
                    {canManage && (
                      <td className="py-2">
                        {member.role === ROLES.PLACEMENT_OFFICER && (
                          <Button
                            variant={member.status === 'active' ? 'danger' : 'secondary'}
                            disabled={busyId === member.id}
                            onClick={() => toggleStatus(member)}
                          >
                            {member.status === 'active' ? 'Disable' : 'Enable'}
                          </Button>
                        )}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  )
}

function CreateOfficerCard({ onCreated }) {
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
      const result = await createOfficer(form)
      setCreated(result)
      setForm({ name: '', email: '' })
      onCreated()
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Card title="Add a placement officer">
      {created && (
        <OneTimeSecret
          label={`Temporary password for ${created.user.email}`}
          value={created.temporaryPassword}
          onDismiss={() => setCreated(null)}
        />
      )}
      <form onSubmit={handleSubmit} className="grid gap-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end" noValidate>
        <TextField label="Officer name" required value={form.name} onChange={update('name')} />
        <TextField label="Officer college email" type="email" required value={form.email} onChange={update('email')} />
        <Button type="submit" disabled={submitting}>
          {submitting ? 'Creating…' : 'Create officer'}
        </Button>
      </form>
      <ErrorAlert message={error} />
      <p className="text-xs text-slate-500">The officer must change the temporary password at first sign-in.</p>
    </Card>
  )
}
