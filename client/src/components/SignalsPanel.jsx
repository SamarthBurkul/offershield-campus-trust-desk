import clsx from 'clsx'
import { AlertTriangle, Info, OctagonAlert, RefreshCw, Sparkles } from 'lucide-react'
import { useState } from 'react'
import { SIGNAL_LABELS, SIGNAL_SEVERITY_TONES } from '../constants/verificationMethods.js'
import { formatDateTime, relativeTime } from '../utils/format.js'
import { Badge, Button, Card, ErrorAlert } from './ui/index.js'

const SEVERITY_STYLE = {
  danger: { box: 'bg-rose-50 ring-rose-600/20 text-rose-950', icon: OctagonAlert, iconClass: 'text-rose-600' },
  warning: { box: 'bg-amber-50 ring-amber-600/25 text-amber-950', icon: AlertTriangle, iconClass: 'text-amber-600' },
  neutral: { box: 'bg-slate-50 ring-slate-300 text-slate-800', icon: Info, iconClass: 'text-slate-500' },
}

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
    <Card title="Warning signals" icon={Sparkles}>
      <p className="-mt-1 text-xs font-medium text-slate-600">Automated hints — not a decision</p>
      {signals.length === 0 ? (
        <p className="text-sm text-slate-600">No warning signals.</p>
      ) : (
        <ul className="space-y-2" aria-label="Warning signals">
          {signals.map((signal) => {
            const tone = SIGNAL_SEVERITY_TONES[signal.severity] ?? 'neutral'
            const style = SEVERITY_STYLE[tone]
            const Icon = style.icon
            return (
              <li key={signal.code} className={clsx('flex gap-2.5 rounded-xl px-3 py-2.5 text-sm ring-1 ring-inset', style.box)}>
                <Icon className={clsx('mt-0.5 h-4 w-4 shrink-0', style.iconClass)} aria-hidden="true" />
                <div className="min-w-0 space-y-0.5">
                  <p className="flex flex-wrap items-center gap-2 font-medium">
                    {SIGNAL_LABELS[signal.code] ?? signal.code}
                    <Badge tone={tone} size="sm">
                      {signal.severity}
                    </Badge>
                  </p>
                  <p className="leading-5">{signal.message}</p>
                  {detailText(signal) && <p className="break-all text-xs opacity-80">{detailText(signal)}</p>}
                </div>
              </li>
            )
          })}
        </ul>
      )}
      <ErrorAlert message={error} />
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
        <span title={computedAt ? formatDateTime(computedAt) : undefined}>{computedAt ? `Computed ${relativeTime(computedAt)}` : 'Not computed yet'}</span>
        <Button variant="secondary" size="sm" icon={RefreshCw} loading={busy} onClick={recompute}>
          {busy ? 'Recomputing…' : 'Recompute'}
        </Button>
      </div>
    </Card>
  )
}
