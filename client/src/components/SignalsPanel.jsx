import { useState } from 'react'
import { SIGNAL_LABELS, SIGNAL_SEVERITY_CLASSES } from '../constants/verificationMethods.js'
import { Button, Card, ErrorAlert } from './ui.jsx'

function detailText(signal) {
  const d = signal.detail ?? {}
  if (d.matches) return d.matches.map((item) => `${item.type}: ${item.value}`).join(', ')
  if (d.lookalikes) return d.lookalikes.map((item) => `${item.domain} imitates ${item.lookalikeOf} (${item.companyName})`).join('; ')
  if (d.verifiedDomains) return `${d.companyName} uses ${d.verifiedDomains.join(', ')}`
  if (d.emails) return d.emails.join(', ')
  if (d.phrase) return `“${d.phrase}”`
  return null
}

/** Staff-only warning signals. Hints for triage; they never decide anything. */
export default function SignalsPanel({ signals = [], computedAt, onRecompute }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function recompute() {
    setBusy(true)
    setError('')
    try {
      await onRecompute()
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card title="Warning signals">
      <p className="text-xs font-medium text-slate-600">Automated hints — not a decision</p>
      {signals.length === 0 ? (
        <p className="text-sm text-slate-600">No warning signals.</p>
      ) : (
        <ul className="space-y-2" aria-label="Warning signals">
          {signals.map((signal) => (
            <li key={signal.code} className={`rounded-md border px-3 py-2 text-sm ${SIGNAL_SEVERITY_CLASSES[signal.severity]}`}>
              <p className="font-medium">
                {SIGNAL_LABELS[signal.code] ?? signal.code} <span className="text-xs uppercase opacity-75">· {signal.severity}</span>
              </p>
              <p>{signal.message}</p>
              {detailText(signal) && <p className="break-all text-xs opacity-80">{detailText(signal)}</p>}
            </li>
          ))}
        </ul>
      )}
      <ErrorAlert message={error} />
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
        <span>{computedAt ? `Computed ${new Date(computedAt).toLocaleString()}` : 'Not computed yet'}</span>
        <Button variant="secondary" disabled={busy} onClick={recompute}>
          {busy ? 'Recomputing…' : 'Recompute'}
        </Button>
      </div>
    </Card>
  )
}
