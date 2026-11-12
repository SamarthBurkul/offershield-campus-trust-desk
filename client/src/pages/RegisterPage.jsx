import { useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { errorMessage } from '../api/errors.js'
import { homePathForRole } from '../auth/roles.js'
import { useAuth } from '../auth/useAuth.js'
import { Button, Card, ErrorAlert, SelectField, TextField } from '../components/ui.jsx'
import usePageTitle from '../hooks/usePageTitle.js'

const EMPTY = { name: '', email: '', password: '', collegeCode: '', joinCode: '', year: '1', branch: '', acceptPolicies: false }

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
    <div className="mx-auto max-w-lg space-y-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-bold text-slate-900">Student registration</h1>
        <p className="text-sm text-slate-600">
          Use your college email address. If your college does not issue student email addresses, use your personal email:
          your placement cell will approve your account. They also give you the college code and join code.
        </p>
      </div>
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
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField label="College code" required value={form.collegeCode} onChange={update('collegeCode')} />
            <TextField label="Join code" required autoComplete="off" value={form.joinCode} onChange={update('joinCode')} />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <SelectField label="Year" value={form.year} onChange={update('year')}>
              {[1, 2, 3, 4, 5].map((year) => (
                <option key={year} value={year}>
                  Year {year}
                </option>
              ))}
            </SelectField>
            <TextField label="Branch" required hint="For example COMP, IT or EXTC." value={form.branch} onChange={update('branch')} />
          </div>
          <div className="flex items-start gap-2">
            <input
              id="accept-policies"
              type="checkbox"
              className="mt-1 h-4 w-4 rounded border-slate-300 text-blue-700"
              checked={form.acceptPolicies}
              onChange={(event) => setForm((current) => ({ ...current, acceptPolicies: event.target.checked }))}
            />
            <label htmlFor="accept-policies" className="text-sm text-slate-800">
              I have read and accept the{' '}
              <Link to="/privacy" target="_blank" className="font-medium text-blue-700 hover:underline">
                privacy notice
              </Link>{' '}
              and the{' '}
              <Link to="/terms" target="_blank" className="font-medium text-blue-700 hover:underline">
                terms of use
              </Link>
              .
            </label>
          </div>
          <Button type="submit" disabled={submitting} className="w-full">
            {submitting ? 'Creating account…' : 'Create account'}
          </Button>
        </form>
      </Card>
      <p className="text-sm text-slate-600">
        Already registered?{' '}
        <Link to="/login" className="font-medium text-blue-700 hover:underline">
          Sign in
        </Link>
      </p>
    </div>
  )
}
