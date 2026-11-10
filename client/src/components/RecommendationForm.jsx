import { useState } from 'react'
import { DECISION_TYPE_LABELS } from '../constants/caseStatus.js'
import { Button, Card, ErrorAlert, SelectField, TextAreaField } from './ui.jsx'

export function CurrentRecommendation({ recommendation }) {
  if (!recommendation) return <p className="text-sm text-slate-600">No recommendation yet.</p>
  return (
    <div className="space-y-1 rounded-md border border-slate-200 bg-slate-50 p-3 text-sm">
      <p className="font-medium text-slate-900">Recommended: {DECISION_TYPE_LABELS[recommendation.type]}</p>
      <p className="whitespace-pre-wrap text-slate-700">{recommendation.basis}</p>
      <p className="text-xs text-slate-500">
        {recommendation.by?.name ?? 'Staff'} · {new Date(recommendation.at).toLocaleString()}
      </p>
    </div>
  )
}

/** Recommend an outcome to the TPO head (staff-only; replaces any earlier recommendation). */
export default function RecommendationForm({ recommendation, onRecommend }) {
  const [type, setType] = useState(recommendation?.type ?? 'confirmed_fraud')
  const [basis, setBasis] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit(event) {
    event.preventDefault()
    if (basis.trim().length < 10) {
      setError('Explain the recommendation in at least 10 characters.')
      return
    }
    setBusy(true)
    setError('')
    try {
      await onRecommend({ type, basis: basis.trim() })
      setBasis('')
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card title="Recommendation">
      <CurrentRecommendation recommendation={recommendation} />
      <form onSubmit={submit} className="space-y-3">
        <SelectField label="Recommended outcome" value={type} onChange={(event) => setType(event.target.value)}>
          {Object.entries(DECISION_TYPE_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </SelectField>
        <TextAreaField label="Why?" rows={3} hint="Staff only. The TPO head records the final decision." value={basis} onChange={(event) => setBasis(event.target.value)} />
        <ErrorAlert message={error} />
        <Button type="submit" disabled={busy}>
          {busy ? 'Saving…' : recommendation ? 'Update recommendation' : 'Add recommendation'}
        </Button>
      </form>
    </Card>
  )
}
