import { Mail } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { forgotPassword } from '../api/auth.js'
import { errorMessage } from '../api/errors.js'
import AuthLayout from '../components/layout/AuthLayout.jsx'
import { Alert, Button, Card, ErrorAlert, TextField } from '../components/ui/index.js'
import usePageTitle from '../hooks/usePageTitle.js'
import usePolicies from '../hooks/usePolicies.js'

const SENT = 'If an account exists for that address, we have sent instructions to it. The link works once and expires in 30 minutes.'

/** /forgot-password: request a one-time reset link (or, without email, ask the placement cell). */
export default function ForgotPasswordPage() {
  usePageTitle('Forgot password')
  const { emailEnabled } = usePolicies()
  const [email, setEmail] = useState('')
  const [error, setError] = useState('')
  const [sent, setSent] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(event) {
    event.preventDefault()
    setError('')
    if (!email.trim()) {
      setError('Enter the email address you sign in with.')
      return
    }
    setSubmitting(true)
    try {
      await forgotPassword(email.trim())
      setSent(true)
    } catch (err) {
      setError(errorMessage(err, 'Unable to send a reset link right now. Please try again.'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <AuthLayout eyebrow="Account help" description="Get back into your account safely." title="Forgot password">
      <Card>
        {!emailEnabled ? (
          <Alert variant="info">Ask your placement cell to reset it. They will give you a temporary password.</Alert>
        ) : sent ? (
          <Alert variant="success">{SENT}</Alert>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4" noValidate>
            <ErrorAlert message={error} />
            <p className="text-sm text-slate-600">
              Enter your email address. If you signed up with Google, we will remind you to use Continue with Google instead.
            </p>
            <TextField label="Email" type="email" autoComplete="username" required value={email} onChange={(event) => setEmail(event.target.value)} />
            <Button type="submit" size="lg" icon={Mail} loading={submitting} className="w-full">
              {submitting ? 'Sending…' : 'Send reset link'}
            </Button>
          </form>
        )}
      </Card>
      <p className="text-center text-sm text-slate-600">
        <Link to="/login" className="font-semibold text-accent-700 hover:text-accent-800">
          Back to sign in
        </Link>
      </p>
    </AuthLayout>
  )
}
