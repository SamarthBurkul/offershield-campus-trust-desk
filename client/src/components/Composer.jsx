import { useState } from 'react'
import { Button, ErrorAlert, TextAreaField } from './ui.jsx'

const TABS = [
  { value: 'message', label: 'Message student', min: 1, max: 3000, action: 'Send message' },
  { value: 'info', label: 'Request information', min: 10, max: 2000, action: 'Request information' },
  { value: 'note', label: 'Internal note', min: 1, max: 5000, action: 'Add internal note' },
]

/**
 * Staff composer. Messages and information requests are shown to the student; internal notes never are.
 * `onSubmit(kind, text)` must resolve on success and throw an Error with a display message on failure.
 * Closed cases only allow internal notes.
 */
export default function Composer({ closed, onSubmit }) {
  const available = closed ? TABS.filter((tab) => tab.value === 'note') : TABS
  const [kind, setKind] = useState(available[0].value)
  const [text, setText] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const tab = available.find((item) => item.value === kind) ?? available[0]
  const length = text.trim().length

  async function submit(event) {
    event.preventDefault()
    if (length < tab.min || length > tab.max) {
      setError(`Write between ${tab.min} and ${tab.max} characters.`)
      return
    }
    setBusy(true)
    setError('')
    try {
      await onSubmit(tab.value, text.trim())
      setText('')
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={submit} className="space-y-3 rounded-lg border border-slate-200 bg-white p-4">
      <div role="tablist" aria-label="Composer" className="flex flex-wrap gap-2">
        {available.map((item) => (
          <button
            key={item.value}
            type="button"
            role="tab"
            aria-selected={item.value === tab.value}
            onClick={() => {
              setKind(item.value)
              setError('')
            }}
            className={`rounded-md px-3 py-1.5 text-sm font-medium ${
              item.value === tab.value ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            {item.value === 'note' && <span aria-hidden="true">🔒 </span>}
            {item.label}
          </button>
        ))}
      </div>
      {tab.value === 'note' ? (
        <p className="flex items-center gap-2 rounded-md bg-slate-100 px-3 py-2 text-sm text-slate-800">
          <span aria-hidden="true">🔒</span> Never shown to the student
        </p>
      ) : (
        <p className="rounded-md bg-blue-50 px-3 py-2 text-sm text-blue-900">
          {tab.value === 'info'
            ? 'The student sees this request and the case moves to "Awaiting student".'
            : 'The student sees this message on their request timeline.'}
        </p>
      )}
      <TextAreaField label={tab.label} rows={4} value={text} onChange={(event) => setText(event.target.value)} />
      <ErrorAlert message={error} />
      <Button type="submit" disabled={busy}>
        {busy ? 'Saving…' : tab.action}
      </Button>
    </form>
  )
}
