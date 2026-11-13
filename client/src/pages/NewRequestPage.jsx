import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { createCase, uploadEvidence } from '../api/cases.js'
import { errorMessage } from '../api/errors.js'
import EvidencePicker from '../components/EvidencePicker.jsx'
import ListInput from '../components/ListInput.jsx'
import { AtSign, Briefcase, IndianRupee, MessageSquareText, Paperclip, Send, ShieldCheck } from 'lucide-react'
import { Alert, Button, CheckboxField, ErrorAlert, PageHeader, SelectField, TextAreaField, TextField } from '../components/ui/index.js'
import { CHANNEL_LABELS, MONEY_PURPOSE_LABELS } from '../constants/caseStatus.js'
import usePageTitle from '../hooks/usePageTitle.js'

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

/** Pre-fill from "Ask your placement cell to verify" links (?company=&email=&phone=&upi=&link=). */
function initialForm(params) {
  const value = (name) => (params.get(name) ?? '').slice(0, 500)
  return {
    ...EMPTY,
    claimedCompany: value('company').slice(0, 120),
    emails: value('email') ? [value('email')] : [],
    phones: value('phone') ? [value('phone')] : [],
    upiIds: value('upi') ? [value('upi')] : [],
    links: value('link') ? [value('link')] : [],
  }
}

export default function NewRequestPage() {
  usePageTitle('New request')
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [form, setForm] = useState(() => initialForm(searchParams))
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
    <div className="space-y-6 pb-24 sm:pb-0">
      <PageHeader
        breadcrumb={[{ label: 'My requests', to: '/student/requests' }, { label: 'New request' }]}
        title="Ask your placement cell to verify an offer"
        description="Tell us how the offer reached you. Your placement cell reviews every request."
      />

      <Alert variant="warning" role="note" title="Protect your identity">
        Do not type or upload Aadhaar or PAN numbers. Crop personal IDs out of screenshots before attaching them.
      </Alert>

      <form onSubmit={handleSubmit} className="space-y-5" noValidate>
        <Step number={1} title="Offer" icon={Briefcase}>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <TextField label="Company name (as claimed)" required value={form.claimedCompany} onChange={onInput('claimedCompany')} />
            <TextField label="Role or position (optional)" value={form.roleTitle} onChange={onInput('roleTitle')} />
          </div>
        </Step>

        <Step number={2} title="How it reached you" icon={MessageSquareText}>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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
        </Step>

        <Step number={3} title="Contacts and links" icon={AtSign} description="Links are stored as text and are never opened by OfferShield.">
          <p className="text-sm text-slate-600">Add any links, email addresses, phone numbers or UPI IDs the recruiter used.</p>
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
            <ListInput label="Links" type="url" max={10} placeholder="https://…" values={form.links} onChange={set('links')} />
            <ListInput label="Emails" type="email" max={5} placeholder="hr@example.com" values={form.emails} onChange={set('emails')} />
            <ListInput label="Phones" type="tel" max={5} placeholder="+91 98765 43210" values={form.phones} onChange={set('phones')} />
            <ListInput label="UPI IDs" max={5} placeholder="name@bank" values={form.upiIds} onChange={set('upiIds')} />
          </div>
        </Step>

        <Step number={4} title="Money" icon={IndianRupee}>
          <CheckboxField label="They asked me to pay money" checked={form.moneyRequested} onChange={onCheck('moneyRequested')} />
          {form.moneyRequested && (
            <div className="grid grid-cols-1 gap-4 rounded-xl bg-slate-50 p-4 ring-1 ring-inset ring-slate-200 sm:grid-cols-2">
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
        </Step>

        <Step number={5} title="Evidence" icon={Paperclip}>
          <EvidencePicker files={files} onChange={setFiles} />
        </Step>

        <Step number={6} title="Consent" icon={ShieldCheck}>
          <CheckboxField
            label="I confirm the details are true to the best of my knowledge and I agree that my placement cell may review this request and its evidence."
            checked={form.consent}
            onChange={onCheck('consent')}
          />
          <ErrorAlert message={error} />
        </Step>

        <div className="fixed inset-x-0 bottom-0 z-20 border-t border-slate-200 bg-white/95 px-4 py-3 backdrop-blur sm:static sm:border-0 sm:bg-transparent sm:p-0 sm:backdrop-blur-none">
          <div className="mx-auto flex max-w-5xl items-center justify-between gap-3">
            <p className="hidden text-sm text-slate-500 sm:block">Your placement cell is notified as soon as you submit.</p>
            <Button type="submit" size="lg" icon={Send} loading={submitting} className="w-full sm:w-auto">
              {submitting ? 'Submitting…' : 'Submit request'}
            </Button>
          </div>
        </div>
      </form>
    </div>
  )
}

/** A numbered form section. */
function Step({ number, title, icon: Icon, description, children }) {
  return (
    <section aria-labelledby={`step-${number}`} className="rounded-2xl bg-white shadow-card ring-1 ring-slate-900/5">
      <div className="flex items-center gap-3 border-b border-slate-100 px-5 py-4">
        <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-900 text-sm font-semibold text-white" aria-hidden="true">
          {number}
        </span>
        <div className="min-w-0">
          <h2 id={`step-${number}`} className="flex items-center gap-2 text-base font-semibold text-slate-900">
            {title}
            <Icon className="h-4 w-4 text-slate-400" aria-hidden="true" />
          </h2>
          {description && <p className="text-xs text-slate-500">{description}</p>}
        </div>
      </div>
      <div className="space-y-4 p-5">{children}</div>
    </section>
  )
}
