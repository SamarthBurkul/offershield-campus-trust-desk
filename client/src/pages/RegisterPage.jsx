import { UserPlus } from 'lucide-react'
import { useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { errorMessage } from '../api/errors.js'
import { homePathForRole } from '../auth/roles.js'
import { useAuth } from '../auth/useAuth.js'
import AuthLayout from '../components/layout/AuthLayout.jsx'
import { Button, Card, ErrorAlert, SelectField, TextField } from '../components/ui/index.js'
import usePageTitle from '../hooks/usePageTitle.js'

const EMPTY = { name: '', email: '', password: '', collegeCode: '', joinCode: '', year: '1', branch: '', acceptPolicies: false }

const POINTS = [
  { title: 'Your college, only', body: 'Register with the college code and join code from your placement cell. Other colleges never see your data.' },
  { title: 'No college email?', body: 'Use your personal email. Your placement cell approves your account before you can use the desk.' },
  { title: 'Never asked for ID numbers', body: 'OfferShield never asks for Aadhaar, PAN, bank details or OTPs.' },
]

export default function RegisterPage() {
  usePageTitle('Student registration')
  const { user, loading, register } = useAuth()
  const navigate = useNavigate()
  const [form, setForm] = useState(EMPTY)
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

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
      await register({ ...form, year: Number(form.year) })
      navigate('/student', { replace: true })
    } catch (err) {
      setError(errorMessage(err, 'Unable to register right now. Please try again.'))
      setSubmitting(false)
    }
  }

  return (
    <AuthLayout eyebrow="For students" description="Check before you pay. Ask before you share." points={POINTS} title="Student registration">
      <p className="-mt-3 text-sm leading-6 text-slate-600">
        Use your college email address. If your college does not issue student email addresses, use your personal email:
        your placement cell will approve your account. They also give you the college code and join code.
      </p>
      <Card>
        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          <ErrorAlert message={error} />
          <TextField label="Full name" autoComplete="name" required value={form.name} onChange={update('name')} />
          <TextField
            label="Email"
            type="email"
            autoComplete="email"
            required
            hint="Your college email address, unless your placement cell says otherwise."
            value={form.email}
            onChange={update('email')}
          />
          <TextField
            label="Password"
            type="password"
            autoComplete="new-password"
            required
            hint="At least 10 characters, with at least one letter and one number."
            value={form.password}
            onChange={update('password')}
          />
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
              id="accept-policies"
              type="checkbox"
              className="mt-0.5 h-4 w-4 shrink-0 cursor-pointer rounded accent-accent-600"
              checked={form.acceptPolicies}
              onChange={(event) => setForm((current) => ({ ...current, acceptPolicies: event.target.checked }))}
            />
            <label htmlFor="accept-policies" className="cursor-pointer text-sm leading-5 text-slate-800">
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
      <p className="text-center text-sm text-slate-600">
        Already registered?{' '}
        <Link to="/login" className="font-semibold text-accent-700 hover:text-accent-800">
          Sign in
        </Link>
      </p>
    </AuthLayout>
  )
}
