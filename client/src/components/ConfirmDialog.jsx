import { useEffect, useId, useRef } from 'react'
import { Button } from './ui.jsx'

const TEXT_FIELD = 'textarea, input:not([type="checkbox"]):not([type="radio"]):not([type="hidden"])'

/** Minimal accessible modal confirmation. Render it only while open. */
export default function ConfirmDialog({ title, children, confirmLabel = 'Confirm', onConfirm, onCancel, busy = false, danger = false }) {
  const titleId = useId()
  const dialogRef = useRef(null)
  const cancelRef = useRef(null)
  // Callers usually pass an inline onCancel, which is a new function on every render (every keystroke
  // in a reason field). Reading it through a ref keeps the effects below from re-running on each render.
  const onCancelRef = useRef(onCancel)
  useEffect(() => {
    onCancelRef.current = onCancel
  })

  // Runs once per opening: focus the first text field (or Cancel). Re-focusing on every render is what
  // used to pull the cursor out of the field while typing.
  useEffect(() => {
    const field = dialogRef.current?.querySelector(TEXT_FIELD)
    ;(field ?? cancelRef.current)?.focus()
  }, [])

  useEffect(() => {
    const onKey = (event) => event.key === 'Escape' && onCancelRef.current()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
      <div ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby={titleId} className="w-full max-w-lg space-y-4 rounded-lg bg-white p-6 shadow-xl">
        <h2 id={titleId} className="text-lg font-semibold text-slate-900">
          {title}
        </h2>
        <div className="space-y-3 text-sm text-slate-700">{children}</div>
        <div className="flex justify-end gap-3">
          <Button variant="secondary" ref={cancelRef} onClick={onCancel} disabled={busy}>
            Cancel
          </Button>
          <Button variant={danger ? 'danger' : 'primary'} onClick={onConfirm} disabled={busy}>
            {busy ? 'Working…' : confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  )
}
