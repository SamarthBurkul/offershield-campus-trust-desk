import { UserPlus } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom'
import { completeGoogleRegistration, getGooglePending } from '../api/auth.js'
import { errorMessage } from '../api/errors.js'
import { homePathForRole } from '../auth/roles.js'
import { useAuth } from '../auth/useAuth.js'
import AuthLayout from '../components/layout/AuthLayout.jsx'
import { Alert, Button, Card, ErrorAlert, SelectField, Skeleton, TextField } from '../components/ui/index.js'
import usePageTitle from '../hooks/usePageTitle.js'

const EMPTY = { collegeCode: '', joinCode: '', year: '1', branch: '', acceptPolicies: false }

const POINTS = [
  { title: 'Signed in with Google', body: 'Google confirmed your email address. OfferShield receives only your name, email and Google account id.' },
  { title: 'Your college, only', body: 'Enter the college code and join code from your placement cell to finish.' },
  { title: 'No password to remember', body: 'Next time, just use Continue with Google.' },
]

/** /register/google: finish a sign-up started with Google (college details + consent). */
export default function GoogleCompletePage() {
  usePageTitle('Finish registration')
  const { user, loading, refresh } = useAuth()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const [pending, setPending] = useState(null)
  const [expired, setExpired] = useState(false)
  const [form, setForm] = useState(EMPTY)
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    let active = true
    Promise.resolve()
      .then(() => getGooglePending())
      .then((value) => active && setPending(value))
      .catch(() => active && setExpired(true))
    return () => {
      active = false
    }
  }, [])

  if (!loading && user && !submitting) return <Navigate to={homePathForRole(user.role)} replace />

  const update = (field) => (event) => setForm((current) => ({ ...current, [field]: event.target.value }))

  async function handleSubmit(event) {
    event.preventDefault()
    setError('')
    if (!form.acceptPolicies) {
      setError('Please read and accept the privacy notice and terms of use.')
      return
    }
    setSubmitting(true)
    try {
      await completeGoogleRegistration({ ...form, year: Number(form.year) })
      const signedIn = await refresh()
      navigate(homePathForRole(signedIn?.role ?? 'student'), { replace: true })
    } catch (err) {
      setError(errorMessage(err, 'Unable to finish registration right now. Please try again.'))
      setSubmitting(false)
    }
  }

  return (
    <AuthLayout eyebrow="For students" description="Check before you pay. Ask before you share." points={POINTS} title="Finish your registration">
      {params.get('notice') === 'no_account' && (
        <Alert variant="info">There is no OfferShield account for this Google address yet. Finish registering below to create one.</Alert>
      )}
      {expired ? (
        <Card>
          <Alert variant="warning">Your Google sign-up has expired or was not started. Start again with Continue with Google.</Alert>
          <Link to="/register" className="font-semibold text-accent-700 hover:text-accent-800">
            Back to registration
          </Link>
        </Card>
      ) : !pending ? (
        <Skeleton rows={3} label="Loading your Google account" />
      ) : (
        <Card>
          <form onSubmit={handleSubmit} className="space-y-4" noValidate>
            <ErrorAlert message={error} />
            <div className="rounded-xl bg-slate-50 p-3 text-sm ring-1 ring-inset ring-slate-200">
              <p className="font-medium text-slate-900">{pending.name}</p>
              <p className="text-slate-600">{pending.email}</p>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <TextField label="College code" required value={form.collegeCode} onChange={update('collegeCode')} />
              <TextField label="Join code" required autoComplete="off" value={form.joinCode} onChange={update('joinCode')} />
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <SelectField label="Year" value={form.year} onChange={update('year')}>
                {[1, 2, 3, 4, 5].map((year) => (
                  <option key={year} value={year}>
                    Year {year}
                  </option>
                ))}
              </SelectField>
              <TextField label="Branch" required hint="For example COMP, IT or EXTC." value={form.branch} onChange={update('branch')} />
            </div>
            <div className="flex items-start gap-2.5 rounded-xl bg-slate-50 p-3 ring-1 ring-inset ring-slate-200">
              <input
                id="google-accept-policies"
                type="checkbox"
                className="mt-0.5 h-4 w-4 shrink-0 cursor-pointer rounded accent-accent-600"
                checked={form.acceptPolicies}
                onChange={(event) => setForm((current) => ({ ...current, acceptPolicies: event.target.checked }))}
              />
              <label htmlFor="google-accept-policies" className="cursor-pointer text-sm leading-5 text-slate-800">
                I have read and accept the{' '}
                <Link to="/privacy" target="_blank" className="font-medium text-accent-700 underline underline-offset-2">
                  privacy notice
                </Link>{' '}
                and the{' '}
                <Link to="/terms" target="_blank" className="font-medium text-accent-700 underline underline-offset-2">
                  terms of use
                </Link>
                .
              </label>
            </div>
            <Button type="submit" size="lg" icon={UserPlus} loading={submitting} className="w-full">
              {submitting ? 'Creating account…' : 'Create account'}
            </Button>
          </form>
        </Card>
      )}
    </AuthLayout>
  )
}
