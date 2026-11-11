import { useState } from 'react'
import { VERIFICATION_METHOD_LABELS } from '../constants/verificationMethods.js'
import { splitList } from '../utils/lists.js'
import { Button, CheckboxField, ErrorAlert, TextAreaField, TextField } from './ui.jsx'

const toggle = (list, value) => (list.includes(value) ? list.filter((item) => item !== value) : [...list, value])

/**
 * Create a recruiter record (or prefill one from a verified_genuine decision). `onSubmit(body)` must
 * throw an Error with a display message on failure.
 */
export default function RecruiterForm({ initial = {}, onSubmit, onCancel, isHead }) {
  const [form, setForm] = useState({
    companyName: initial.companyName ?? '',
    domains: (initial.domains ?? []).join(', '),
    contactEmails: (initial.contactEmails ?? []).join(', '),
    contactPhones: (initial.contactPhones ?? []).join(', '),
    methods: initial.methods ?? [],
    evidenceNote: initial.evidenceNote ?? '',
    expiresInDays: '365',
  })
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const set = (patch) => setForm((current) => ({ ...current, ...patch }))
  const field = (name) => (event) => set({ [name]: event.target.value })

  const problems = []
  if (form.companyName.trim().length < 2) problems.push('Enter the company name.')
  if (splitList(form.domains).length === 0) problems.push('Add at least one official domain.')
  if (form.methods.length === 0) problems.push('Select at least one verification method.')
  if (form.evidenceNote.trim().length < 20) problems.push('Evidence note must be at least 20 characters.')

  async function submit(event) {
    event.preventDefault()
    if (problems.length) return
    setBusy(true)
    setError('')
    try {
      await onSubmit({
        companyName: form.companyName.trim(),
        domains: splitList(form.domains),
        contactEmails: splitList(form.contactEmails),
        contactPhones: splitList(form.contactPhones),
        methods: form.methods,
        evidenceNote: form.evidenceNote.trim(),
        expiresInDays: Number(form.expiresInDays),
        ...(initial.sourceCaseId ? { sourceCaseId: initial.sourceCaseId } : {}),
      })
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4" aria-label="Recruiter form" noValidate>
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField label="Company name" value={form.companyName} onChange={field('companyName')} />
        <TextField label="Official domains" hint="Comma-separated, e.g. infosys.com" value={form.domains} onChange={field('domains')} />
        <TextField label="Contact emails" hint="Must use the domains above; no gmail etc." value={form.contactEmails} onChange={field('contactEmails')} />
        <TextField label="Contact phones" hint="Comma-separated" value={form.contactPhones} onChange={field('contactPhones')} />
      </div>
      <fieldset className="space-y-2">
        <legend className="text-sm font-medium text-slate-700">Verification methods</legend>
        {Object.entries(VERIFICATION_METHOD_LABELS).map(([value, label]) => (
          <CheckboxField key={value} label={label} checked={form.methods.includes(value)} onChange={() => set({ methods: toggle(form.methods, value) })} />
        ))}
      </fieldset>
      <TextAreaField label="Evidence note" rows={3} hint="What you checked and where (20–2000 characters)." value={form.evidenceNote} onChange={field('evidenceNote')} />
      <TextField label="Valid for (days)" type="number" min="30" max="730" value={form.expiresInDays} onChange={field('expiresInDays')} />
      {!isHead && <p className="text-sm text-slate-600">Your TPO head must approve this record before students see it as verified.</p>}
      {problems.length > 0 && (
        <ul className="list-disc pl-5 text-sm text-amber-800" aria-label="Missing recruiter details">
          {problems.map((problem) => (
            <li key={problem}>{problem}</li>
          ))}
        </ul>
      )}
      <ErrorAlert message={error} />
      <div className="flex gap-3">
        <Button type="submit" disabled={busy || problems.length > 0}>
          {busy ? 'Saving…' : isHead ? 'Save verified recruiter' : 'Submit for approval'}
        </Button>
        {onCancel && (
          <Button variant="secondary" onClick={onCancel}>
            Cancel
          </Button>
        )}
      </div>
    </form>
  )
}
