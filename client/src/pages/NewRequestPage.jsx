import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { createCase, uploadEvidence } from '../api/cases.js'
import { errorMessage } from '../api/errors.js'
import EvidencePicker from '../components/EvidencePicker.jsx'
import ListInput from '../components/ListInput.jsx'
import { Button, Card, CheckboxField, ErrorAlert, SelectField, TextAreaField, TextField } from '../components/ui.jsx'
import { CHANNEL_LABELS, MONEY_PURPOSE_LABELS } from '../constants/caseStatus.js'

const today = () => new Date().toISOString().slice(0, 10)

const EMPTY = {
  claimedCompany: '',
  roleTitle: '',
  channel: 'whatsapp',
  receivedAt: today(),
  messageText: '',
  links: [],
  emails: [],
  phones: [],
  upiIds: [],
  moneyRequested: false,
  amount: '',
  purpose: '',
  paidAlready: false,
  documentsShared: false,
  studentNote: '',
  consent: false,
}

const clean = (values) => values.map((value) => value.trim()).filter(Boolean)

function toRequestBody(form) {
  return {
    claimedCompany: form.claimedCompany,
    roleTitle: form.roleTitle || undefined,
    channel: form.channel,
    receivedAt: new Date(`${form.receivedAt}T00:00:00`).toISOString(),
    messageText: form.messageText,
    links: clean(form.links),
    contacts: { emails: clean(form.emails), phones: clean(form.phones), upiIds: clean(form.upiIds) },
    moneyRequested: form.moneyRequested
      ? { requested: true, amount: form.amount === '' ? null : Number(form.amount), purpose: form.purpose || null }
      : { requested: false },
    paidAlready: form.paidAlready,
    documentsShared: form.documentsShared,
    studentNote: form.studentNote || undefined,
    consent: form.consent,
  }
}

export default function NewRequestPage() {
  const navigate = useNavigate()
  const [form, setForm] = useState(EMPTY)
  const [files, setFiles] = useState([])
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const set = (field) => (value) => setForm((current) => ({ ...current, [field]: value }))
  const onInput = (field) => (event) => set(field)(event.target.value)
  const onCheck = (field) => (event) => set(field)(event.target.checked)

  async function handleSubmit(event) {
    event.preventDefault()
    setError('')
    if (!form.consent) {
      setError('Please confirm the consent statement before submitting.')
      return
    }
    setSubmitting(true)
    let created
    try {
      created = await createCase(toRequestBody(form))
    } catch (err) {
      setError(errorMessage(err, 'Your request could not be submitted. Please try again.'))
      setSubmitting(false)
      return
    }

    // The request exists now; an upload failure is retried from the detail page.
    let uploadFailed = false
    if (files.length > 0) {
      try {
        await uploadEvidence(created.id, files)
      } catch {
        uploadFailed = true
      }
    }
    navigate(`/student/requests/${created.id}`, { state: { uploadFailed } })
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-bold text-slate-900">Ask your placement cell to verify an offer</h1>
        <p className="text-slate-600">Tell us how the offer reached you. Your placement cell reviews every request.</p>
      </div>

      <p role="note" className="rounded-md border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
        <strong>Protect your identity:</strong> do not type or upload Aadhaar or PAN numbers. Crop personal IDs out of
        screenshots before attaching them.
      </p>

      <form onSubmit={handleSubmit} className="space-y-6" noValidate>
        <Card title="Offer">
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField label="Company name (as claimed)" required value={form.claimedCompany} onChange={onInput('claimedCompany')} />
            <TextField label="Role or position (optional)" value={form.roleTitle} onChange={onInput('roleTitle')} />
          </div>
        </Card>

        <Card title="How it reached you">
          <div className="grid gap-4 sm:grid-cols-2">
            <SelectField label="Channel" value={form.channel} onChange={onInput('channel')}>
              {Object.entries(CHANNEL_LABELS).map(([value, text]) => (
                <option key={value} value={value}>
                  {text}
                </option>
              ))}
            </SelectField>
            <TextField label="Date received" type="date" max={today()} required value={form.receivedAt} onChange={onInput('receivedAt')} />
          </div>
          <TextAreaField
            label="Message you received"
            rows={6}
            required
            hint="Paste the offer text (10–5000 characters). Remove any personal ID numbers."
            value={form.messageText}
            onChange={onInput('messageText')}
          />
        </Card>

        <Card title="Contacts and links">
          <p className="text-sm text-slate-600">
            Add any links, email addresses, phone numbers or UPI IDs the recruiter used. Links are stored as text and are
            never opened by OfferShield.
          </p>
          <div className="grid gap-6 sm:grid-cols-2">
            <ListInput label="Links" type="url" max={10} placeholder="https://…" values={form.links} onChange={set('links')} />
            <ListInput label="Emails" type="email" max={5} placeholder="hr@example.com" values={form.emails} onChange={set('emails')} />
            <ListInput label="Phones" type="tel" max={5} placeholder="+91 98765 43210" values={form.phones} onChange={set('phones')} />
            <ListInput label="UPI IDs" max={5} placeholder="name@bank" values={form.upiIds} onChange={set('upiIds')} />
          </div>
        </Card>

        <Card title="Money">
          <CheckboxField label="They asked me to pay money" checked={form.moneyRequested} onChange={onCheck('moneyRequested')} />
          {form.moneyRequested && (
            <div className="grid gap-4 sm:grid-cols-2">
              <TextField label="Amount requested (₹)" type="number" min="0" value={form.amount} onChange={onInput('amount')} />
              <SelectField label="What was it for?" value={form.purpose} onChange={onInput('purpose')}>
                <option value="">Not stated</option>
                {Object.entries(MONEY_PURPOSE_LABELS).map(([value, text]) => (
                  <option key={value} value={value}>
                    {text}
                  </option>
                ))}
              </SelectField>
            </div>
          )}
          <CheckboxField label="I have already paid" checked={form.paidAlready} onChange={onCheck('paidAlready')} />
          <CheckboxField
            label="I have already shared personal documents with them"
            hint="Yes/no only — never upload the documents themselves."
            checked={form.documentsShared}
            onChange={onCheck('documentsShared')}
          />
          <TextAreaField label="Anything else? (optional)" rows={3} value={form.studentNote} onChange={onInput('studentNote')} />
        </Card>

        <Card title="Evidence">
          <EvidencePicker files={files} onChange={setFiles} />
        </Card>

        <Card title="Consent">
          <CheckboxField
            label="I confirm the details are true to the best of my knowledge and I agree that my placement cell may review this request and its evidence."
            checked={form.consent}
            onChange={onCheck('consent')}
          />
          <ErrorAlert message={error} />
          <Button type="submit" disabled={submitting}>
            {submitting ? 'Submitting…' : 'Submit request'}
          </Button>
        </Card>
      </form>
    </div>
  )
}
