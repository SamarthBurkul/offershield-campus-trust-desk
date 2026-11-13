import clsx from 'clsx'
import { Search } from 'lucide-react'
import { useId, useState } from 'react'
import { errorMessage } from '../api/errors.js'
import { lookup } from '../api/lookup.js'
import LookupResultCard from './LookupResultCard.jsx'
import { Button, Card, ErrorAlert } from './ui/index.js'

/**
 * "Check before you pay": searches the college's confirmed fraud indicators and verified recruiters.
 * `variant="hero"` is the large student version drawn on a navy band.
 */
export default function LookupBox({ staff = false, variant = 'card' }) {
  const id = useId()
  const [query, setQuery] = useState('')
  const [result, setResult] = useState(null)
  const [searched, setSearched] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const hero = variant === 'hero'

  async function submit(event) {
    event.preventDefault()
    const q = query.trim()
    if (q.length < 3) {
      setError('Enter at least 3 characters.')
      return
    }
    setBusy(true)
    setError('')
    try {
      setResult(await lookup(q))
      setSearched(q)
    } catch (err) {
      setResult(null)
      setError(errorMessage(err, 'The lookup is unavailable right now. Please try again.'))
    } finally {
      setBusy(false)
    }
  }

  const form = (
    <form onSubmit={submit} className="space-y-2" role="search">
      <label htmlFor={id} className={clsx('block text-sm font-medium', hero ? 'text-brand-100' : 'text-slate-700')}>
        Look up
      </label>
      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className={clsx('pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400', hero ? 'h-5 w-5' : 'h-4 w-4')} aria-hidden="true" />
          <input
            id={id}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            aria-describedby={`${id}-hint`}
            placeholder="e.g. hr.desk@okaxis, careers-company.in, +91 98…"
            className={clsx(
              'w-full rounded-xl border-0 bg-white text-slate-900 shadow-sm ring-1 ring-inset ring-slate-300 transition placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-accent-500',
              hero ? 'h-14 pl-12 pr-4 text-base' : 'h-11 pl-10 pr-3 text-sm',
            )}
          />
        </div>
        <Button type="submit" size={hero ? 'lg' : 'md'} loading={busy} className={hero ? 'h-14! px-7!' : 'h-11!'}>
          {busy ? 'Checking…' : 'Check'}
        </Button>
      </div>
      <p id={`${id}-hint`} className={clsx('text-xs', hero ? 'text-brand-200' : 'text-slate-500')}>
        company, website, email, phone or UPI ID
      </p>
    </form>
  )

  if (hero) {
    return (
      <div className="space-y-5">
        {form}
        <ErrorAlert message={error} />
        {result && <LookupResultCard result={result} query={searched} showAskButton={!staff} size="lg" className="shadow-overlay" />}
      </div>
    )
  }

  return (
    <Card title="Check before you pay" icon={Search}>
      {form}
      <ErrorAlert message={error} />
      {result && <LookupResultCard result={result} query={searched} showAskButton={!staff} />}
    </Card>
  )
}
