import { LogOut, MailCheck } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { resendVerification, verifyEmail } from '../api/auth.js'
import { errorMessage } from '../api/errors.js'
import { needsEmailVerification } from '../auth/accountState.js'
import { homePathForRole } from '../auth/roles.js'
import { useAuth } from '../auth/useAuth.js'
import { Alert, Button, Card, ErrorAlert } from '../components/ui/index.js'
import usePageTitle from '../hooks/usePageTitle.js'

const LENGTH = 6
// A code was just sent at registration, so resend starts on cooldown.
const COOLDOWN_SECONDS = 60

/** /verify-email: six paste-friendly digit boxes, resend with a countdown. */
export default function VerifyEmailPage() {
  usePageTitle('Verify your email')
  const { user, emailVerificationRequired, refresh, logout } = useAuth()
  const navigate = useNavigate()
  const [digits, setDigits] = useState(() => Array(LENGTH).fill(''))
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [cooldown, setCooldown] = useState(COOLDOWN_SECONDS)
  const inputs = useRef([])

  useEffect(() => {
    if (cooldown <= 0) return undefined
    const timer = setTimeout(() => setCooldown((value) => value - 1), 1000)
    return () => clearTimeout(timer)
  }, [cooldown])

  if (!needsEmailVerification(user, emailVerificationRequired)) return <Navigate to={homePathForRole(user.role)} replace />

  const focusBox = (index) => inputs.current[Math.max(0, Math.min(LENGTH - 1, index))]?.focus()

  function fill(start, text) {
    const clean = text.replace(/\D/g, '').slice(0, LENGTH - start)
    if (!clean) return
    setDigits((current) => {
      const next = [...current]
      for (let i = 0; i < clean.length; i += 1) next[start + i] = clean[i]
      return next
    })
    focusBox(start + clean.length)
  }

  function handleChange(index, event) {
    const value = event.target.value
    if (value === '') {
      setDigits((current) => current.map((digit, i) => (i === index ? '' : digit)))
      return
    }
    fill(index, value)
  }

  function handleKeyDown(index, event) {
    if (event.key === 'Backspace' && !digits[index] && index > 0) {
      event.preventDefault()
      setDigits((current) => current.map((digit, i) => (i === index - 1 ? '' : digit)))
      focusBox(index - 1)
    } else if (event.key === 'ArrowLeft') focusBox(index - 1)
    else if (event.key === 'ArrowRight') focusBox(index + 1)
  }

  function handlePaste(index, event) {
    event.preventDefault()
    fill(index, event.clipboardData.getData('text'))
  }

  const code = digits.join('')

  async function handleSubmit(event) {
    event.preventDefault()
    setError('')
    setNotice('')
    if (code.length !== LENGTH) {
      setError('Enter all 6 digits of the code.')
      return
    }
    setSubmitting(true)
    try {
      await verifyEmail(code)
      const updated = await refresh()
      navigate(homePathForRole(updated?.role ?? user.role), { replace: true })
    } catch (err) {
      setError(errorMessage(err, 'That code did not work. Please try again.'))
      setDigits(Array(LENGTH).fill(''))
      focusBox(0)
      setSubmitting(false)
    }
  }

  async function handleResend() {
    setError('')
    setNotice('')
    try {
      const result = await resendVerification()
      setNotice('We sent a new code. Codes expire after 10 minutes.')
      setCooldown(result?.retryAfterSeconds || COOLDOWN_SECONDS)
    } catch (err) {
      const wait = err?.response?.data?.error?.details?.retryAfterSeconds
      if (wait) setCooldown(wait)
      setError(errorMessage(err, 'Could not send a new code right now.'))
    }
  }

  async function handleLogout() {
    await logout()
    navigate('/login', { replace: true })
  }

  return (
    <div className="mx-auto max-w-md space-y-6 py-4">
      <div className="flex flex-col items-center text-center">
        <span className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-50 text-brand-700 ring-1 ring-inset ring-brand-100" aria-hidden="true">
          <MailCheck className="h-7 w-7" />
        </span>
        <h1 className="mt-5 text-2xl font-semibold tracking-tight text-slate-900">Verify your email</h1>
        <p className="mt-2 text-slate-600">
          We sent a 6-digit code to <span className="font-medium text-slate-900">{user.email}</span>. Enter it below.
        </p>
      </div>
      <Card>
        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          <ErrorAlert message={error} />
          {notice && <Alert variant="success">{notice}</Alert>}
          <fieldset>
            <legend className="sr-only">Verification code</legend>
            <div className="flex justify-center gap-2">
              {digits.map((digit, index) => (
                <input
                  key={index}
                  ref={(element) => {
                    inputs.current[index] = element
                  }}
                  value={digit}
                  onChange={(event) => handleChange(index, event)}
                  onKeyDown={(event) => handleKeyDown(index, event)}
                  onPaste={(event) => handlePaste(index, event)}
                  inputMode="numeric"
                  autoComplete={index === 0 ? 'one-time-code' : 'off'}
                  maxLength={LENGTH}
                  aria-label={`Digit ${index + 1}`}
                  className="h-12 w-11 rounded-xl border border-slate-300 bg-white text-center font-mono text-xl font-semibold text-slate-900 shadow-sm focus-visible:border-accent-500 focus-visible:outline-2 focus-visible:outline-accent-500"
                />
              ))}
            </div>
          </fieldset>
          <Button type="submit" size="lg" loading={submitting} className="w-full">
            {submitting ? 'Verifying…' : 'Verify email'}
          </Button>
        </form>
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4 text-sm">
          <Button variant="ghost" size="sm" disabled={cooldown > 0} onClick={handleResend}>
            {cooldown > 0 ? `Resend code in ${cooldown}s` : 'Resend code'}
          </Button>
          <Button variant="ghost" size="sm" icon={LogOut} onClick={handleLogout}>
            Log out
          </Button>
        </div>
      </Card>
      <p className="text-center text-sm text-slate-500">Check your spam folder if the email has not arrived after a minute.</p>
    </div>
  )
}
