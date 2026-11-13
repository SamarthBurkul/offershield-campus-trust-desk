import clsx from 'clsx'
import { X } from 'lucide-react'
import { useId, useRef } from 'react'
import { createPortal } from 'react-dom'
import { IconButton } from './Button.jsx'
import { useModalBehaviour } from './overlay.js'

/**
 * Slide-over panel (right by default; `side="left"` for navigation). Render it only while open; same focus,
 * Escape and focus-return behaviour as Dialog.
 */
export function Drawer({ title, description, children, footer, onClose, side = 'right', width = 'max-w-xl', className, bodyClassName, hideHeader = false }) {
  const titleId = useId()
  const panelRef = useRef(null)
  useModalBehaviour(panelRef, { onClose })

  return createPortal(
    <div className="fixed inset-0 z-50 flex">
      <div className="absolute inset-0 animate-fade-in bg-brand-950/50 backdrop-blur-[2px]" aria-hidden="true" onMouseDown={onClose} />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className={clsx(
          'relative flex h-full w-full flex-col bg-white shadow-overlay focus:outline-none',
          side === 'left' ? 'mr-auto animate-slide-in-left' : 'ml-auto animate-slide-in-right',
          width,
          className,
        )}
      >
        <div className={clsx('flex items-start justify-between gap-4 border-b border-slate-100 px-6 py-4', hideHeader && 'sr-only')}>
          <div className="min-w-0">
            <h2 id={titleId} className="text-lg font-semibold tracking-tight text-slate-900">
              {title}
            </h2>
            {description && <p className="mt-1 text-sm text-slate-500">{description}</p>}
          </div>
          <IconButton icon={X} label="Close" size="sm" onClick={onClose} />
        </div>
        <div className={clsx('min-h-0 flex-1 overflow-y-auto px-6 py-5', bodyClassName)}>{children}</div>
        {footer && <div className="flex flex-wrap justify-end gap-3 border-t border-slate-100 bg-slate-50/70 px-6 py-4">{footer}</div>}
      </div>
    </div>,
    document.body,
  )
}
