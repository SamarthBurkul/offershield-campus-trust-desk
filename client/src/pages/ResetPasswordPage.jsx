import { KeyRound } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { resetPassword } from '../api/auth.js'
import { errorMessage } from '../api/errors.js'
import AuthLayout from '../components/layout/AuthLayout.jsx'
import { Alert, Button, Card, ErrorAlert, TextField } from '../components/ui/index.js'
import usePageTitle from '../hooks/usePageTitle.js'

/**
 * Read the reset token from the link (#token=… or ?token=…) once, then remove it from the address bar
 * so it is not kept in history, bookmarks or screenshots. The server sends Referrer-Policy: no-referrer.
 */
function takeTokenFromUrl() {
  if (typeof window === 'undefined') return ''
  const { hash, search, pathname } = window.location
  const token = new URLSearchParams(hash.replace(/^#/, '')).get('token') || new URLSearchParams(search).get('token') || ''
  if (token) window.history.replaceState(window.history.state, '', pathname)
  return token
}

/** /reset-password: choose a new password with a one-time emailed link. */
export default function ResetPasswordPage() {
  usePageTitle('Choose a new password')
  const [token] = useState(takeTokenFromUrl)
  const [form, setForm] = useState({ newPassword: '', confirmPassword: '' })
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)
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
      await resetPassword(token, form.newPassword)
      setDone(true)
    } catch (err) {
      setError(errorMessage(err, 'Unable to change your password right now. Please try again.'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <AuthLayout eyebrow="Account help" description="Get back into your account safely." title="Choose a new password">
      <Card>
        {!token ? (
          <Alert variant="warning">This reset link is incomplete. Open the link from the email again, or request a new one.</Alert>
        ) : done ? (
          <Alert variant="success">Your password has been changed and other sessions were signed out. Sign in with your new password.</Alert>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4" noValidate>
            <ErrorAlert message={error} />
            <TextField
              label="New password"
              type="password"
              autoComplete="new-password"
              required
              hint="At least 10 characters, with at least one letter and one number."
              value={form.newPassword}
              onChange={update('newPassword')}
            />
            <TextField label="Confirm new password" type="password" autoComplete="new-password" required value={form.confirmPassword} onChange={update('confirmPassword')} />
            <Button type="submit" size="lg" icon={KeyRound} loading={submitting} className="w-full">
              {submitting ? 'Saving…' : 'Set new password'}
            </Button>
          </form>
        )}
      </Card>
      <p className="flex justify-center gap-4 text-center text-sm text-slate-600">
        <Link to="/login" className="font-semibold text-accent-700 hover:text-accent-800">
          Sign in
        </Link>
        <Link to="/forgot-password" className="font-semibold text-accent-700 hover:text-accent-800">
          Request a new link
        </Link>
      </p>
    </AuthLayout>
  )
}
