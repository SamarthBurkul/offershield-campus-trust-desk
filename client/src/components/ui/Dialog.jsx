import clsx from 'clsx'
import { X } from 'lucide-react'
import { useId, useRef } from 'react'
import { createPortal } from 'react-dom'
import { Button, IconButton } from './Button.jsx'
import { useModalBehaviour } from './overlay.js'

/**
 * Modal dialog. Render it only while open. Focus moves to the first text field once on open (or to
 * `initialFocusRef`), Tab is trapped, Escape calls `onClose`, and focus returns to the trigger on close.
 */
export function Dialog({ title, description, children, footer, onClose, size = 'md', initialFocusRef, labelledBy, className }) {
  const generatedId = useId()
  const titleId = labelledBy ?? `${generatedId}-title`
  const panelRef = useRef(null)
  useModalBehaviour(panelRef, { onClose, fallbackRef: initialFocusRef })

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-4">
      <div className="absolute inset-0 animate-fade-in bg-brand-950/50 backdrop-blur-[2px]" aria-hidden="true" onMouseDown={onClose} />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className={clsx(
          'relative flex max-h-[92vh] w-full animate-pop-in flex-col overflow-hidden rounded-t-2xl bg-white shadow-overlay ring-1 ring-slate-900/10 focus:outline-none sm:rounded-2xl',
          { sm: 'sm:max-w-md', md: 'sm:max-w-lg', lg: 'sm:max-w-2xl' }[size],
          className,
        )}
      >
        <div className="flex items-start justify-between gap-4 px-6 pb-2 pt-5">
          <div className="min-w-0">
            <h2 id={titleId} className="text-lg font-semibold tracking-tight text-slate-900">
              {title}
            </h2>
            {description && <p className="mt-1 text-sm text-slate-500">{description}</p>}
          </div>
          {onClose && <IconButton icon={X} label="Close" size="sm" onClick={onClose} />}
        </div>
        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-6 py-3 text-sm text-slate-700">{children}</div>
        {footer && <div className="flex flex-wrap justify-end gap-3 border-t border-slate-100 bg-slate-50/70 px-6 py-4">{footer}</div>}
      </div>
    </div>,
    document.body,
  )
}

/**
 * Confirmation dialog (unchanged API since Phase 4). Focuses the first text field once on open, or Cancel
 * when there is none; never re-focuses on re-render (the Phase 7 typing fix).
 */
export function ConfirmDialog({ title, children, confirmLabel = 'Confirm', onConfirm, onCancel, busy = false, danger = false }) {
  const cancelRef = useRef(null)
  return (
    <Dialog
      title={title}
      onClose={onCancel}
      initialFocusRef={cancelRef}
      footer={
        <>
          <Button variant="secondary" ref={cancelRef} onClick={onCancel} disabled={busy}>
            Cancel
          </Button>
          <Button variant={danger ? 'danger' : 'primary'} onClick={onConfirm} disabled={busy}>
            {busy ? 'Working…' : confirmLabel}
          </Button>
        </>
      }
    >
      {children}
    </Dialog>
  )
}
