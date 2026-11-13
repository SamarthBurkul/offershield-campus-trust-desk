import { KeyRound, Save } from 'lucide-react'
import { useEffect, useState } from 'react'
import { getAccount, updateAccount } from '../api/account.js'
import { errorMessage } from '../api/errors.js'
import { ROLES } from '../auth/roles.js'
import { useAuth } from '../auth/useAuth.js'
import {
  Badge,
  Button,
  ButtonLink,
  Card,
  Checkbox,
  ErrorAlert,
  KeyValueList,
  PageHeader,
  SelectField,
  Skeleton,
  TextField,
  useToast,
} from '../components/ui/index.js'
import usePageTitle from '../hooks/usePageTitle.js'

const METHOD_LABELS = { password: 'Email and password', google: 'Google' }

const STUDENT_PREFS = [
  { key: 'caseUpdates', label: 'Updates on my verification requests', hint: 'When your placement cell asks for information, sends a message, records an outcome or reopens a request.' },
  { key: 'advisories', label: 'Warning and critical advisories', hint: 'New advisories your placement cell sends to your year or branch.' },
]
const STAFF_PREFS = [{ key: 'staffAlerts', label: 'New requests and students waiting for approval', hint: 'One email per new verification request or pending registration.' }]

/** /account: own profile, sign-in methods and email preferences (every role). */
export default function AccountPage() {
  usePageTitle('Account')
  const { college, refresh } = useAuth()
  const toast = useToast()
  const [account, setAccount] = useState(null)
  const [form, setForm] = useState(null)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    let active = true
    Promise.resolve()
      .then(() => getAccount())
      .then((value) => {
        if (!active || !value) return
        setAccount(value)
        setForm({ name: value.name, year: String(value.year ?? ''), branch: value.branch ?? '' })
      })
      .catch((err) => active && setError(errorMessage(err, 'Could not load your account.')))
    return () => {
      active = false
    }
  }, [])

  if (!account || !form) {
    return (
      <div className="space-y-6">
        <PageHeader title="Account" />
        <ErrorAlert message={error} />
        {!error && <Skeleton rows={4} label="Loading your account" />}
      </div>
    )
  }

  const isStudent = account.role === ROLES.STUDENT
  const prefs = isStudent ? STUDENT_PREFS : account.collegeId ? STAFF_PREFS : []
  const update = (field) => (event) => setForm((current) => ({ ...current, [field]: event.target.value }))

  async function saveProfile(event) {
    event.preventDefault()
    setError('')
    const changes = {}
    if (form.name.trim() && form.name.trim() !== account.name) changes.name = form.name.trim()
    if (isStudent && Number(form.year) !== account.year) changes.year = Number(form.year)
    if (isStudent && form.branch.trim().toUpperCase() !== account.branch) changes.branch = form.branch.trim().toUpperCase()
    if (Object.keys(changes).length === 0) {
      toast.show({ tone: 'info', message: 'Nothing to save.' })
      return
    }
    setSaving(true)
    try {
      const updated = await updateAccount(changes)
      setAccount(updated)
      setForm({ name: updated.name, year: String(updated.year ?? ''), branch: updated.branch ?? '' })
      await refresh()
      toast.success('Profile saved.')
    } catch (err) {
      setError(errorMessage(err, 'Could not save your profile.'))
    } finally {
      setSaving(false)
    }
  }

  async function togglePref(key, value) {
    setError('')
    try {
      const updated = await updateAccount({ emailPrefs: { [key]: value } })
      setAccount(updated)
      toast.success(value ? 'Email turned on.' : 'Email turned off.')
    } catch (err) {
      setError(errorMessage(err, 'Could not update your email preferences.'))
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Account" description="Your profile, how you sign in and which emails you receive." />
      <ErrorAlert message={error} />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card title="Profile">
          <form onSubmit={saveProfile} className="space-y-4" noValidate>
            <TextField label="Full name" autoComplete="name" required value={form.name} onChange={update('name')} />
            {isStudent && (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <SelectField label="Year" value={form.year} onChange={update('year')}>
                  {[1, 2, 3, 4, 5].map((year) => (
                    <option key={year} value={year}>
                      Year {year}
                    </option>
                  ))}
                </SelectField>
                {college?.branches?.length ? (
                  <SelectField label="Branch" value={form.branch} onChange={update('branch')}>
                    {college.branches.map((branch) => (
                      <option key={branch} value={branch}>
                        {branch}
                      </option>
                    ))}
                  </SelectField>
                ) : (
                  <TextField label="Branch" value={form.branch} onChange={update('branch')} />
                )}
              </div>
            )}
            <Button type="submit" icon={Save} loading={saving}>
              {saving ? 'Saving…' : 'Save profile'}
            </Button>
          </form>
        </Card>
        <Card title="Sign-in">
          <KeyValueList
            items={[
              {
                term: 'Email',
                value: (
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="break-all">{account.email}</span>
                    {account.emailVerified ? <Badge tone="info">Email verified</Badge> : <Badge tone="warning">Not verified</Badge>}
                  </span>
                ),
              },
              { term: 'Sign-in methods', value: account.authMethods.map((method) => METHOD_LABELS[method] ?? method).join(', ') },
            ]}
          />
          <p className="text-xs text-slate-500">Your email address cannot be changed here. Ask your placement cell if it is wrong.</p>
          {account.hasPassword && (
            <ButtonLink to="/change-password" variant="secondary" icon={KeyRound}>
              Change password
            </ButtonLink>
          )}
        </Card>
        {prefs.length > 0 && (
          <Card title="Email notifications" className="lg:col-span-2">
            <p className="text-sm text-slate-600">
              Security emails (verification codes, password resets, password changes) are always sent. You can turn the others off.
            </p>
            <div className="space-y-3">
              {prefs.map((pref) => (
                <Checkbox
                  key={pref.key}
                  label={pref.label}
                  hint={pref.hint}
                  checked={account.emailPrefs[pref.key] !== false}
                  onChange={(event) => togglePref(pref.key, event.target.checked)}
                />
              ))}
            </div>
          </Card>
        )}
      </div>
    </div>
  )
}
