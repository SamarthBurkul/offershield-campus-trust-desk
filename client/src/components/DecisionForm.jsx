import { useState } from 'react'
import { Link } from 'react-router-dom'
import { listStaffCases } from '../api/staffCases.js'
import {
  DECISION_CHECK_LABELS,
  DECISION_TYPE_LABELS,
  DISMISS_REASON_LABELS,
  INDICATOR_TYPE_LABELS,
  STUDENT_OUTCOME_COPY,
} from '../constants/caseStatus.js'
import ConfirmDialog from './ConfirmDialog.jsx'
import { Gavel, Search } from 'lucide-react'
import { Button, Card, CheckboxField, ErrorAlert, SelectField, TextAreaField, TextField } from './ui/index.js'

const STRONG = ['confirmed_fraud', 'verified_genuine']
const key = (item) => `${item.type}:${item.value}`

/** What is still missing before this decision can be recorded (mirrors the server rules). */
function decisionProblems(form) {
  const problems = []
  const minBasis = STRONG.includes(form.type) ? 30 : 10
  if (form.basis.trim().length < minBasis) problems.push(`Basis must be at least ${minBasis} characters.`)
  if (STRONG.includes(form.type) && form.checks.length === 0) problems.push('Select at least one check you performed.')
  if (form.type === 'confirmed_fraud' && form.indicators.length === 0) problems.push('Select at least one confirmed indicator.')
  if (form.type === 'dismissed' && !form.dismissReason) problems.push('Choose a dismiss reason.')
  if (form.type === 'dismissed' && form.dismissReason === 'duplicate' && !form.duplicateOf) problems.push('Choose the case this duplicates.')
  if (form.studentMessage.trim().length < 10) problems.push('The message to the student must be at least 10 characters.')
  return problems
}

function toRequestBody(form, indicators) {
  const body = { type: form.type, basis: form.basis.trim(), checks: form.checks, studentMessage: form.studentMessage.trim() }
  if (form.type === 'confirmed_fraud') {
    body.confirmedIndicators = indicators.filter((item) => form.indicators.includes(key(item))).map(({ type, value }) => ({ type, value }))
  }
  if (form.type === 'verified_genuine' && form.verifiedDomains.length) body.verifiedDomains = form.verifiedDomains
  if (form.type === 'dismissed') {
    body.dismissReason = form.dismissReason
    if (form.dismissReason === 'duplicate') body.duplicateOfCaseId = form.duplicateOf.id
  }
  return body
}

const toggle = (list, value) => (list.includes(value) ? list.filter((item) => item !== value) : [...list, value])

/** TPO head only. The server re-validates everything and records the decision atomically. */
export default function DecisionForm({ caseData, onDecide }) {
  const [form, setForm] = useState({
    type: caseData.recommendation?.type ?? 'confirmed_fraud',
    basis: '',
    checks: [],
    indicators: [],
    verifiedDomains: [],
    dismissReason: '',
    duplicateOf: null,
    studentMessage: '',
  })
  const [duplicateQuery, setDuplicateQuery] = useState('')
  const [duplicateResults, setDuplicateResults] = useState(null)
  const [confirming, setConfirming] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [conflict, setConflict] = useState(null)

  const set = (patch) => setForm((current) => ({ ...current, ...patch }))
  const problems = decisionProblems(form)
  const domains = caseData.indicators.filter((item) => item.type === 'domain')

  async function findDuplicate() {
    setDuplicateResults(null)
    try {
      const { cases } = await listStaffCases({ q: duplicateQuery.trim(), status: undefined, limit: 10 })
      setDuplicateResults(cases.filter((item) => item.id !== caseData.id))
    } catch {
      setDuplicateResults([])
    }
  }

  async function confirm() {
    setBusy(true)
    setError('')
    setConflict(null)
    try {
      await onDecide(toRequestBody(form, caseData.indicators))
    } catch (err) {
      setError(err.message)
      if (err.code === 'CONFLICTS_WITH_VERIFIED_RECRUITER') setConflict(err.details ?? {})
      setConfirming(false)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card title="Record decision" icon={Gavel} description="TPO head only. The student sees only your message.">
      <form
        className="space-y-4"
        onSubmit={(event) => {
          event.preventDefault()
          if (problems.length === 0) setConfirming(true)
        }}
        noValidate
      >
        <SelectField label="Decision" value={form.type} onChange={(event) => set({ type: event.target.value })}>
          {Object.entries(DECISION_TYPE_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </SelectField>

        <TextAreaField
          label="Basis (staff only)"
          rows={4}
          hint={`What you verified and how. ${STRONG.includes(form.type) ? 'At least 30' : 'At least 10'} characters. Never shown to the student.`}
          value={form.basis}
          onChange={(event) => set({ basis: event.target.value })}
        />

        {STRONG.includes(form.type) && (
          <fieldset className="space-y-2">
            <legend className="text-sm font-medium text-slate-700">Checks performed</legend>
            {Object.entries(DECISION_CHECK_LABELS).map(([value, label]) => (
              <CheckboxField key={value} label={label} checked={form.checks.includes(value)} onChange={() => set({ checks: toggle(form.checks, value) })} />
            ))}
          </fieldset>
        )}

        {form.type === 'confirmed_fraud' && (
          <fieldset className="space-y-2">
            <legend className="text-sm font-medium text-slate-700">Confirmed indicators</legend>
            {caseData.indicators.length === 0 && <p className="text-sm text-slate-600">This case has no indicators to confirm.</p>}
            {caseData.indicators.map((item) => (
              <CheckboxField
                key={key(item)}
                label={`${INDICATOR_TYPE_LABELS[item.type] ?? item.type}: ${item.value}`}
                checked={form.indicators.includes(key(item))}
                onChange={() => set({ indicators: toggle(form.indicators, key(item)) })}
              />
            ))}
          </fieldset>
        )}

        {form.type === 'verified_genuine' && domains.length > 0 && (
          <fieldset className="space-y-2">
            <legend className="text-sm font-medium text-slate-700">Verified official domains (optional)</legend>
            {domains.map((item) => (
              <CheckboxField
                key={item.value}
                label={item.value}
                checked={form.verifiedDomains.includes(item.value)}
                onChange={() => set({ verifiedDomains: toggle(form.verifiedDomains, item.value) })}
              />
            ))}
          </fieldset>
        )}

        {form.type === 'dismissed' && (
          <div className="space-y-3">
            <SelectField label="Dismiss reason" value={form.dismissReason} onChange={(event) => set({ dismissReason: event.target.value, duplicateOf: null })}>
              <option value="">Choose a reason</option>
              {Object.entries(DISMISS_REASON_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </SelectField>
            {form.dismissReason === 'duplicate' && (
              <div className="space-y-2">
                <div className="flex items-end gap-2">
                  <TextField label="Duplicate of case number" className="flex-1" value={duplicateQuery} onChange={(event) => setDuplicateQuery(event.target.value)} />
                  <Button variant="secondary" icon={Search} disabled={!duplicateQuery.trim()} onClick={findDuplicate}>
                    Find
                  </Button>
                </div>
                {duplicateResults?.length === 0 && <p className="text-sm text-slate-600">No other case matches.</p>}
                {duplicateResults?.map((item) => (
                  <CheckboxField
                    key={item.id}
                    label={`${item.caseNumber} — ${item.claimedCompany}`}
                    checked={form.duplicateOf?.id === item.id}
                    onChange={() => set({ duplicateOf: form.duplicateOf?.id === item.id ? null : item })}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        <TextAreaField
          label="Message to the student"
          rows={3}
          hint="10–1000 characters. This is the only explanation the student sees."
          value={form.studentMessage}
          onChange={(event) => set({ studentMessage: event.target.value })}
        />
        <div className="rounded-xl bg-slate-50 p-3 text-sm ring-1 ring-inset ring-slate-200" aria-label="Student preview">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">What the student will see</p>
          <p className="mt-1 font-medium text-slate-900">{STUDENT_OUTCOME_COPY[form.type]}</p>
          <p className="whitespace-pre-wrap text-slate-700">{form.studentMessage || '…'}</p>
        </div>

        {problems.length > 0 && (
          <ul className="list-disc space-y-1 rounded-xl bg-amber-50 py-2.5 pl-8 pr-3 text-sm text-amber-900 ring-1 ring-inset ring-amber-600/20" aria-label="Missing before you can record">
            {problems.map((problem) => (
              <li key={problem}>{problem}</li>
            ))}
          </ul>
        )}
        <ErrorAlert message={error} />
        {conflict && (
          <p className="text-sm">
            <Link to={`/staff/registry?recruiter=${conflict.recruiterId ?? ''}`} className="font-medium text-accent-700 underline">
              Open {conflict.companyName ?? 'the recruiter'} in the registry
            </Link>{' '}
            to suspend it first.
          </p>
        )}
        <Button type="submit" icon={Gavel} disabled={problems.length > 0} className="w-full">
          Record decision
        </Button>
      </form>

      {confirming && (
        <ConfirmDialog
          title={`Record "${DECISION_TYPE_LABELS[form.type]}"?`}
          confirmLabel="Record decision"
          danger={form.type === 'confirmed_fraud'}
          busy={busy}
          onConfirm={confirm}
          onCancel={() => setConfirming(false)}
        >
          <p>This closes the case and notifies the student with your message.</p>
          <p className="font-medium">The decision, its checks and who recorded it are written to the audit log.</p>
        </ConfirmDialog>
      )}
    </Card>
  )
}
