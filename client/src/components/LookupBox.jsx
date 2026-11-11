import { useState } from 'react'
import { errorMessage } from '../api/errors.js'
import { lookup } from '../api/lookup.js'
import LookupResultCard from './LookupResultCard.jsx'
import { Button, Card, ErrorAlert, TextField } from './ui.jsx'

/** "Check before you pay": searches the college's confirmed fraud indicators and verified recruiters. */
export default function LookupBox({ staff = false }) {
  const [query, setQuery] = useState('')
  const [result, setResult] = useState(null)
  const [searched, setSearched] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

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

  return (
    <Card title="Check before you pay">
      <form onSubmit={submit} className="flex flex-wrap items-end gap-3" role="search">
        <TextField
          label="Look up"
          className="min-w-64 flex-1"
          hint="company, website, email, phone or UPI ID"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
        <Button type="submit" disabled={busy}>
          {busy ? 'Checking…' : 'Check'}
        </Button>
      </form>
      <ErrorAlert message={error} />
      {result && <LookupResultCard result={result} query={searched} showAskButton={!staff} />}
    </Card>
  )
}
