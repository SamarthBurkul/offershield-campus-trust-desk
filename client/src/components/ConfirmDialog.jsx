import { useEffect, useId, useRef } from 'react'
import { Button } from './ui.jsx'

/** Minimal accessible modal confirmation. Render it only while open. */
export default function ConfirmDialog({ title, children, confirmLabel = 'Confirm', onConfirm, onCancel, busy = false, danger = false }) {
  const titleId = useId()
  const cancelRef = useRef(null)

  useEffect(() => {
    cancelRef.current?.focus()
    const onKey = (event) => event.key === 'Escape' && onCancel()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onCancel])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
      <div role="dialog" aria-modal="true" aria-labelledby={titleId} className="w-full max-w-lg space-y-4 rounded-lg bg-white p-6 shadow-xl">
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
