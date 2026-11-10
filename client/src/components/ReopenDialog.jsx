import { useState } from 'react'
import ConfirmDialog from './ConfirmDialog.jsx'
import { ErrorAlert, TextAreaField } from './ui.jsx'

/** TPO head reopens a closed case with a staff-only reason (10–1000 characters). */
export default function ReopenDialog({ onReopen, onCancel }) {
  const [reason, setReason] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function confirm() {
    if (reason.trim().length < 10) {
      setError('Give a reason of at least 10 characters.')
      return
    }
    setBusy(true)
    setError('')
    try {
      await onReopen(reason.trim())
    } catch (err) {
      setError(err.message)
      setBusy(false)
    }
  }

  return (
    <ConfirmDialog title="Reopen this case?" confirmLabel="Reopen case" onConfirm={confirm} onCancel={onCancel} busy={busy}>
      <p>
        The current decision moves to the decision history and the case returns to review. The student only sees
        &ldquo;Your request has been reopened for further review.&rdquo;
      </p>
      <TextAreaField label="Reason (staff only)" rows={3} value={reason} onChange={(event) => setReason(event.target.value)} />
      <ErrorAlert message={error} />
    </ConfirmDialog>
  )
}
