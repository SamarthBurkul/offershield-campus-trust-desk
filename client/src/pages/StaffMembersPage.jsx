import { KeyRound, UserCheck, UserPlus, UserX } from 'lucide-react'
import { useEffect, useState } from 'react'
import { errorMessage } from '../api/errors.js'
import { createOfficer, listStaffMembers, setOfficerStatus } from '../api/staff.js'
import { resetUserPassword } from '../api/students.js'
import { ROLE_LABELS, ROLES } from '../auth/roles.js'
import { useAuth } from '../auth/useAuth.js'
import {
  Avatar,
  Badge,
  Button,
  Card,
  Drawer,
  ErrorAlert,
  OneTimeSecret,
  PageHeader,
  Skeleton,
  StatusBadge,
  Table,
  TBody,
  Td,
  TextField,
  Th,
  THead,
  Tr,
  useToast,
} from '../components/ui/index.js'
import usePageTitle from '../hooks/usePageTitle.js'

export default function StaffMembersPage() {
  usePageTitle('Staff members')
  const { user } = useAuth()
  const toast = useToast()
  const canManage = user.role === ROLES.TPO_HEAD
  const [members, setMembers] = useState(null)
  const [loadError, setLoadError] = useState('')
  const [actionError, setActionError] = useState('')
  const [busyId, setBusyId] = useState(null)
  const [reloadKey, setReloadKey] = useState(0)
  const [secret, setSecret] = useState(null)
  const [creating, setCreating] = useState(false)

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
      toast.success(`${updated.name} is now ${updated.status}.`)
    } catch (err) {
      setActionError(errorMessage(err))
    } finally {
      setBusyId(null)
    }
  }

  async function resetPassword(member) {
    setActionError('')
    setBusyId(member.id)
    try {
      const { temporaryPassword } = await resetUserPassword(member.id)
      setSecret({ email: member.email, password: temporaryPassword })
    } catch (err) {
      setActionError(errorMessage(err))
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Staff members"
        description="Placement officers and the TPO head of your college."
        actions={
          canManage && (
            <Button icon={UserPlus} onClick={() => setCreating(true)}>
              Add a placement officer
            </Button>
          )
        }
      />

      {secret && <OneTimeSecret label={`Temporary password for ${secret.email}`} value={secret.password} onDismiss={() => setSecret(null)} />}

      <Card padded={false}>
        <div className="p-5 empty:hidden">
          <ErrorAlert message={loadError || actionError} />
          {members === null && !loadError && <Skeleton rows={3} label="Loading staff" />}
        </div>
        {members && (
          <Table label="Your college's staff">
            <THead>
              <tr>
                <Th>Name</Th>
                <Th>Email</Th>
                <Th>Role</Th>
                <Th>Status</Th>
                {canManage && <Th className="text-right">Actions</Th>}
              </tr>
            </THead>
            <TBody>
              {members.map((member) => (
                <Tr key={member.id}>
                  <Td>
                    <span className="flex items-center gap-3">
                      <Avatar name={member.name} size="sm" />
                      <span className="font-medium text-slate-900">{member.name}</span>
                    </span>
                  </Td>
                  <Td className="break-all text-slate-600">{member.email}</Td>
                  <Td>
                    <Badge tone={member.role === ROLES.TPO_HEAD ? 'brand' : 'neutral'}>{ROLE_LABELS[member.role]}</Badge>
                  </Td>
                  <Td>
                    <StatusBadge status={member.status} />
                  </Td>
                  {canManage && (
                    <Td className="text-right">
                      {member.role === ROLES.PLACEMENT_OFFICER && (
                        <div className="inline-flex flex-wrap justify-end gap-2">
                          <Button
                            size="sm"
                            variant="secondary"
                            icon={member.status === 'active' ? UserX : UserCheck}
                            disabled={busyId === member.id}
                            onClick={() => toggleStatus(member)}
                          >
                            {member.status === 'active' ? 'Disable' : 'Enable'}
                          </Button>
                          <Button size="sm" variant="secondary" icon={KeyRound} disabled={busyId === member.id} onClick={() => resetPassword(member)}>
                            Reset password
                          </Button>
                        </div>
                      )}
                    </Td>
                  )}
                </Tr>
              ))}
            </TBody>
          </Table>
        )}
      </Card>

      {creating && (
        <CreateOfficerDrawer
          onClose={() => setCreating(false)}
          onCreated={(result) => {
            setCreating(false)
            setSecret({ email: result.user.email, password: result.temporaryPassword })
            setReloadKey((key) => key + 1)
            toast.success(`${result.user.name} was added as a placement officer.`)
          }}
        />
      )}
    </div>
  )
}

function CreateOfficerDrawer({ onClose, onCreated }) {
  const [form, setForm] = useState({ name: '', email: '' })
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const update = (field) => (event) => setForm((current) => ({ ...current, [field]: event.target.value }))

  async function handleSubmit(event) {
    event.preventDefault()
    setError('')
    setSubmitting(true)
    try {
      onCreated(await createOfficer(form))
    } catch (err) {
      setError(errorMessage(err))
      setSubmitting(false)
    }
  }

  return (
    <Drawer title="Add a placement officer" description="They must change the temporary password at first sign-in." onClose={onClose} width="max-w-md">
      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        <TextField label="Officer name" required value={form.name} onChange={update('name')} />
        <TextField label="Officer college email" type="email" required value={form.email} onChange={update('email')} />
        <ErrorAlert message={error} />
        <div className="flex gap-3">
          <Button type="submit" icon={UserPlus} loading={submitting}>
            {submitting ? 'Creating…' : 'Create officer'}
          </Button>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
        </div>
      </form>
    </Drawer>
  )
}
