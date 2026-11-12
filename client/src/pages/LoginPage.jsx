import { useState } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { errorMessage } from '../api/errors.js'
import { homePathForRole } from '../auth/roles.js'
import { useAuth } from '../auth/useAuth.js'
import { Button, Card, ErrorAlert, TextField } from '../components/ui.jsx'
import usePageTitle from '../hooks/usePageTitle.js'

export default function LoginPage() {
  usePageTitle('Sign in')
  const { user, loading, login } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [form, setForm] = useState({ email: '', password: '' })
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [showForgot, setShowForgot] = useState(false)

  if (!loading && user && !submitting) return <Navigate to={homePathForRole(user.role)} replace />

  const update = (field) => (event) => setForm((current) => ({ ...current, [field]: event.target.value }))

  async function handleSubmit(event) {
    event.preventDefault()
    setError('')
    setSubmitting(true)
    try {
      const signedIn = await login(form)
      const home = homePathForRole(signedIn.role)
      // Only return to the requested page if it belongs to this role's area.
      const from = location.state?.from
      navigate(from && from.startsWith(home) ? from : home, { replace: true })
    } catch (err) {
      setError(errorMessage(err, 'Unable to sign in right now. Please try again.'))
      setSubmitting(false)
    }
  }

  return (
    <div className="mx-auto max-w-md space-y-6">
      <h1 className="text-2xl font-bold text-slate-900">Sign in</h1>
      <Card>
        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          <ErrorAlert message={error} />
          <TextField label="Email" type="email" autoComplete="username" required value={form.email} onChange={update('email')} />
          <TextField
            label="Password"
            type="password"
            autoComplete="current-password"
            required
            value={form.password}
            onChange={update('password')}
          />
          <Button type="submit" disabled={submitting} className="w-full">
            {submitting ? 'Signing in…' : 'Sign in'}
          </Button>
        </form>
        <div className="space-y-2 text-sm">
          <button
            type="button"
            className="font-medium text-blue-700 hover:underline"
            aria-expanded={showForgot}
            onClick={() => setShowForgot((value) => !value)}
          >
            Forgot password?
          </button>
          {showForgot && <p className="text-slate-700">Ask your placement cell to reset it. They will give you a temporary password.</p>}
        </div>
      </Card>
      <p className="text-sm text-slate-600">
        Student without an account?{' '}
        <Link to="/register" className="font-medium text-blue-700 hover:underline">
          Register as a student
        </Link>
      </p>
    </div>
  )
}
