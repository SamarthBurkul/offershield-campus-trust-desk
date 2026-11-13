import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { changePassword } from '../api/auth.js'
import { errorMessage } from '../api/errors.js'
import { homePathForRole } from '../auth/roles.js'
import { useAuth } from '../auth/useAuth.js'
import { KeyRound } from 'lucide-react'
import { Alert, Button, Card, ErrorAlert, TextField } from '../components/ui/index.js'
import usePageTitle from '../hooks/usePageTitle.js'

export default function ChangePasswordPage() {
  usePageTitle('Change password')
  const { user, refresh } = useAuth()
  const navigate = useNavigate()
  const [form, setForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' })
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const update = (field) => (event) => setForm((current) => ({ ...current, [field]: event.target.value }))

  async function handleSubmit(event) {
    event.preventDefault()
    setError('')
    if (form.newPassword !== form.confirmPassword) {
      setError('The new passwords do not match.')
      return
    }
    setSubmitting(true)
    try {
      await changePassword({ currentPassword: form.currentPassword, newPassword: form.newPassword })
      const updated = await refresh()
      navigate(homePathForRole(updated?.role), { replace: true })
    } catch (err) {
      setError(errorMessage(err))
      setSubmitting(false)
    }
  }

  return (
    <div className="mx-auto max-w-md space-y-6 py-2">
      <div className="space-y-3">
        <span className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-brand-50 text-brand-700" aria-hidden="true">
          <KeyRound className="h-5 w-5" />
        </span>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Change password</h1>
        {user?.mustChangePassword && <Alert variant="warning">You signed in with a temporary password. Choose a new password to continue.</Alert>}
      </div>
      <Card>
        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          <ErrorAlert message={error} />
          <TextField
            label="Current password"
            type="password"
            autoComplete="current-password"
            required
            value={form.currentPassword}
            onChange={update('currentPassword')}
          />
          <TextField
            label="New password"
            type="password"
            autoComplete="new-password"
            required
            hint="At least 10 characters, with at least one letter and one number."
            value={form.newPassword}
            onChange={update('newPassword')}
          />
          <TextField
            label="Confirm new password"
            type="password"
            autoComplete="new-password"
            required
            value={form.confirmPassword}
            onChange={update('confirmPassword')}
          />
          <Button type="submit" size="lg" loading={submitting} className="w-full">
            {submitting ? 'Saving…' : 'Change password'}
          </Button>
        </form>
      </Card>
    </div>
  )
}
