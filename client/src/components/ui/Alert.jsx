import clsx from 'clsx'
import { AlertTriangle, CheckCircle2, Info, OctagonAlert } from 'lucide-react'

const VARIANTS = {
  info: { box: 'bg-sky-50 text-sky-950 ring-sky-600/20', icon: Info, iconClass: 'text-sky-600' },
  success: { box: 'bg-emerald-50 text-emerald-950 ring-emerald-600/20', icon: CheckCircle2, iconClass: 'text-emerald-600' },
  warning: { box: 'bg-amber-50 text-amber-950 ring-amber-600/25', icon: AlertTriangle, iconClass: 'text-amber-600' },
  danger: { box: 'bg-rose-50 text-rose-950 ring-rose-600/20', icon: OctagonAlert, iconClass: 'text-rose-600' },
}

/** Inline message box. `role` defaults to "alert" for danger. */
export function Alert({ variant = 'info', title, icon, actions, role, className, children }) {
  const style = VARIANTS[variant] ?? VARIANTS.info
  const Icon = icon ?? style.icon
  return (
    <div role={role ?? (variant === 'danger' ? 'alert' : undefined)} className={clsx('flex gap-3 rounded-xl px-4 py-3 text-sm ring-1 ring-inset', style.box, className)}>
      <Icon className={clsx('mt-0.5 h-4 w-4 shrink-0', style.iconClass)} aria-hidden="true" />
      <div className="min-w-0 flex-1 space-y-1">
        {title && <p className="font-semibold">{title}</p>}
        {children && <div className="leading-6">{children}</div>}
      </div>
      {actions && <div className="flex shrink-0 items-start gap-2">{actions}</div>}
    </div>
  )
}

/** Error message from a failed action (renders nothing without a message). */
export function ErrorAlert({ message }) {
  if (!message) return null
  return <Alert variant="danger">{message}</Alert>
}
