import { useState } from 'react'
import clsx from 'clsx'
import { Eye, HelpCircle, Lock, MessageSquare, Send } from 'lucide-react'
import { Button, ErrorAlert, Tabs, TextAreaField } from './ui/index.js'

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
    <form onSubmit={submit} className={clsx('space-y-4 rounded-2xl bg-white p-5 shadow-card ring-1', tab.value === 'note' ? 'ring-slate-300' : 'ring-slate-900/5')}>
      <Tabs
        label="Composer"
        size="sm"
        value={tab.value}
        onChange={(value) => {
          setKind(value)
          setError('')
        }}
        tabs={available.map((item) => ({ value: item.value, label: item.label, icon: item.value === 'note' ? Lock : item.value === 'info' ? HelpCircle : MessageSquare }))}
      />
      {tab.value === 'note' ? (
        <p className="flex items-center gap-2 rounded-xl bg-slate-100 px-3 py-2 text-sm font-medium text-slate-800">
          <Lock className="h-4 w-4 text-slate-500" aria-hidden="true" />
          <span>Never shown to the student</span>
        </p>
      ) : (
        <p className="flex items-center gap-2 rounded-xl bg-sky-50 px-3 py-2 text-sm text-sky-950 ring-1 ring-inset ring-sky-600/15">
          <Eye className="h-4 w-4 shrink-0 text-sky-600" aria-hidden="true" />
          {tab.value === 'info'
            ? 'The student sees this request and the case moves to "Awaiting student".'
            : 'The student sees this message on their request timeline.'}
        </p>
      )}
      <TextAreaField label={tab.label} rows={4} value={text} onChange={(event) => setText(event.target.value)} className={tab.value === 'note' ? '[&_textarea]:bg-slate-50' : undefined} />
      <ErrorAlert message={error} />
      <div className="flex justify-end">
        <Button type="submit" icon={tab.value === 'note' ? Lock : Send} loading={busy}>
          {busy ? 'Saving…' : tab.action}
        </Button>
      </div>
    </form>
  )
}
