import clsx from 'clsx'
import { CheckCircle2, OctagonAlert, X } from 'lucide-react'
import { useCallback, useMemo, useRef, useState } from 'react'
import { ToastContext } from './toastContext.js'

const DURATION_MS = 4500

/** Wraps the app once; renders a polite live region with transient success / error toasts. */
export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])
  const nextId = useRef(1)

  const dismiss = useCallback((id) => setToasts((items) => items.filter((item) => item.id !== id)), [])
  const show = useCallback(
    ({ tone = 'success', message }) => {
      const id = nextId.current++
      setToasts((items) => [...items.slice(-3), { id, tone, message }])
      setTimeout(() => dismiss(id), DURATION_MS)
    },
    [dismiss],
  )
  const api = useMemo(
    () => ({ show, success: (message) => show({ tone: 'success', message }), error: (message) => show({ tone: 'error', message }) }),
    [show],
  )

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div aria-live="polite" className="pointer-events-none fixed inset-x-4 bottom-4 z-[60] flex flex-col items-end gap-2 sm:left-auto sm:right-6">
        {toasts.map((toast) => {
          const Icon = toast.tone === 'error' ? OctagonAlert : CheckCircle2
          return (
            <div
              key={toast.id}
              className={clsx(
                'pointer-events-auto flex w-full max-w-sm animate-pop-in items-start gap-3 rounded-xl bg-white px-4 py-3 text-sm text-slate-800 shadow-raised ring-1',
                toast.tone === 'error' ? 'ring-rose-200' : 'ring-emerald-200',
              )}
            >
              <Icon className={clsx('mt-0.5 h-4 w-4 shrink-0', toast.tone === 'error' ? 'text-rose-600' : 'text-emerald-600')} aria-hidden="true" />
              <p className="min-w-0 flex-1">{toast.message}</p>
              <button type="button" aria-label="Dismiss" onClick={() => dismiss(toast.id)} className="rounded-md p-0.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700">
                <X className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
            </div>
          )
        })}
      </div>
    </ToastContext.Provider>
  )
}

