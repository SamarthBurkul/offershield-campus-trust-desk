import { KeyRound, LogIn } from 'lucide-react'
import { useState } from 'react'
import { Link, Navigate, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { errorMessage } from '../api/errors.js'
import { homePathForRole } from '../auth/roles.js'
import { useAuth } from '../auth/useAuth.js'
import GoogleButton, { OrDivider } from '../components/GoogleButton.jsx'
import AuthLayout from '../components/layout/AuthLayout.jsx'
import { Alert, Button, Card, ErrorAlert, TextField } from '../components/ui/index.js'
import usePageTitle from '../hooks/usePageTitle.js'
import usePolicies from '../hooks/usePolicies.js'

// Fixed messages for the codes the Google callback may send back (never server text).
const SIGN_IN_ERRORS = {
  google_failed: 'Google sign-in did not work. Please try again, or sign in with your email and password.',
  account_unavailable: 'This account cannot sign in. Contact your placement cell if you think this is a mistake.',
}

const POINTS = [
  { title: 'Check before you pay', body: 'Look up a UPI ID, website, email or phone number against what your placement cell has confirmed.' },
  { title: 'Ask your placement cell', body: 'Send a suspicious offer with screenshots; staff investigate and tell you what they found.' },
  { title: 'Private by design', body: 'Your requests and evidence are visible only to you and your college’s placement staff.' },
]

export default function LoginPage() {
  usePageTitle('Sign in')
  const { user, loading, login } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [form, setForm] = useState({ email: '', password: '' })
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [showForgot, setShowForgot] = useState(false)
  const [params] = useSearchParams()
  const { googleEnabled, emailEnabled } = usePolicies()
  const callbackError = SIGN_IN_ERRORS[params.get('error')] ?? ''

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
    <AuthLayout eyebrow="Campus Recruitment Trust & Verification Desk" description="Check before you pay. Ask before you share." points={POINTS} title="Sign in">
      <Card>
        {callbackError && <ErrorAlert message={callbackError} />}
        {googleEnabled && (
          <>
            <GoogleButton intent="login" />
            <OrDivider />
          </>
        )}
        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          <ErrorAlert message={error} />
          <TextField label="Email" type="email" autoComplete="username" required value={form.email} onChange={update('email')} />
          <TextField label="Password" type="password" autoComplete="current-password" required value={form.password} onChange={update('password')} />
          <Button type="submit" size="lg" icon={LogIn} loading={submitting} className="w-full">
            {submitting ? 'Signing in…' : 'Sign in'}
          </Button>
        </form>
        <div className="space-y-2 border-t border-slate-100 pt-4 text-sm">
          {emailEnabled ? (
            <Link to="/forgot-password" className="inline-flex items-center gap-1.5 font-medium text-accent-700 hover:text-accent-800">
              <KeyRound className="h-4 w-4" aria-hidden="true" />
              Forgot password?
            </Link>
          ) : (
            <button
              type="button"
              className="inline-flex items-center gap-1.5 font-medium text-accent-700 hover:text-accent-800"
              aria-expanded={showForgot}
              onClick={() => setShowForgot((value) => !value)}
            >
              <KeyRound className="h-4 w-4" aria-hidden="true" />
              Forgot password?
            </button>
          )}
          {!emailEnabled && showForgot && (
            <Alert variant="info">Ask your placement cell to reset it. They will give you a temporary password.</Alert>
          )}
        </div>
      </Card>
      <p className="text-center text-sm text-slate-600">
        Student without an account?{' '}
        <Link to="/register" className="font-semibold text-accent-700 hover:text-accent-800">
          Register as a student
        </Link>
      </p>
    </AuthLayout>
  )
}
