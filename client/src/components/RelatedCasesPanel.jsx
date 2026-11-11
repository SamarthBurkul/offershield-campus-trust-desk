import { useState } from 'react'
import { Link } from 'react-router-dom'
import { listStaffCases } from '../api/staffCases.js'
import { RELATED_REASON_LABELS } from '../constants/verificationMethods.js'
import StatusBadge from './StatusBadge.jsx'
import { Button, Card, ErrorAlert, TextField } from './ui.jsx'

/** Staff-only related cases (same college): automatic and manual links. */
export default function RelatedCasesPanel({ caseId, related = [], onLink, onUnlink }) {
  const [caseNumber, setCaseNumber] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function link(event) {
    event.preventDefault()
    setError('')
    setBusy(true)
    try {
      const { cases } = await listStaffCases({ q: caseNumber.trim(), status: undefined, limit: 5 })
      const match = cases.find((item) => item.caseNumber.toLowerCase() === caseNumber.trim().toLowerCase() && item.id !== caseId)
      if (!match) throw new Error('No other case with that number in your college.')
      await onLink(match.id)
      setCaseNumber('')
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  async function unlink(otherId) {
    setError('')
    try {
      await onUnlink(otherId)
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <Card title="Related cases">
      {related.length === 0 ? (
        <p className="text-sm text-slate-600">No related cases.</p>
      ) : (
        <ul className="space-y-3" aria-label="Related cases">
          {related.map((item) => (
            <li key={item.caseId} className="space-y-1 rounded-md border border-slate-200 p-3 text-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <Link to={`/staff/cases/${item.caseId}`} className="font-mono font-medium text-blue-700 hover:underline">
                  {item.caseNumber ?? item.caseId}
                </Link>
                {item.status && <StatusBadge status={item.status} audience="staff" />}
              </div>
              {item.claimedCompany && <p className="text-slate-700">{item.claimedCompany}</p>}
              <p className="text-xs text-slate-600">
                {item.reasons.map((reason) => RELATED_REASON_LABELS[reason] ?? reason).join(' · ')}
                {item.similarity != null && ` · ${Math.round(item.similarity * 100)}% similar`}
              </p>
              {item.sharedIndicators.length > 0 && (
                <p className="break-all font-mono text-xs text-slate-700">
                  {item.sharedIndicators.map((indicator) => `${indicator.type}: ${indicator.value}`).join(', ')}
                </p>
              )}
              <Button variant="secondary" onClick={() => unlink(item.caseId)}>
                Unlink
              </Button>
            </li>
          ))}
        </ul>
      )}
      <form onSubmit={link} className="flex items-end gap-2">
        <TextField label="Link case number" className="flex-1" placeholder="OS-…-0001" value={caseNumber} onChange={(event) => setCaseNumber(event.target.value)} />
        <Button type="submit" variant="secondary" disabled={busy || caseNumber.trim().length < 3}>
          Link
        </Button>
      </form>
      <ErrorAlert message={error} />
    </Card>
  )
}
