import { useState } from 'react'
import { Link } from 'react-router-dom'
import { acknowledgeAdvisory } from '../api/advisories.js'
import AdvisoryCard from './AdvisoryCard.jsx'
import { ArrowRight, Check } from 'lucide-react'
import { Button } from './ui/index.js'

/** Unacknowledged advisories on the student home, each with "I've read this". */
export default function AdvisoryBanner({ advisories, onAcknowledged }) {
  const [busyId, setBusyId] = useState(null)
  const [error, setError] = useState('')
  const pending = advisories.filter((item) => !item.acknowledged)
  if (pending.length === 0) return null

  async function acknowledge(id) {
    setBusyId(id)
    setError('')
    try {
      await acknowledgeAdvisory(id)
      onAcknowledged(id)
    } catch {
      setError('Could not record that. Please try again.')
    } finally {
      setBusyId(null)
    }
  }

  return (
    <section aria-label="Advisories from your placement cell" className="space-y-3">
      {pending.map((advisory) => (
        <AdvisoryCard key={advisory.id} advisory={advisory}>
          <div className="flex flex-wrap items-center gap-3">
            <Button icon={Check} loading={busyId === advisory.id} onClick={() => acknowledge(advisory.id)}>
              {busyId === advisory.id ? 'Saving…' : "I've read this"}
            </Button>
            <Link to={`/advisories/${advisory.id}`} className="inline-flex items-center gap-1 text-sm font-medium underline underline-offset-2">
              Open advisory <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
            </Link>
          </div>
        </AdvisoryCard>
      ))}
      {error && (
        <p role="alert" className="text-sm font-medium text-rose-700">
          {error}
        </p>
      )}
    </section>
  )
}
