import clsx from 'clsx'
import { Check, Copy, Inbox, KeyRound } from 'lucide-react'
import { useState } from 'react'
import { Button } from './Button.jsx'

/** Friendly empty list / error block: icon, title, text and an optional action. */
export function EmptyState({ icon: Icon = Inbox, title, children, action, className, as: Heading = 'p' }) {
  return (
    <div className={clsx('flex flex-col items-center rounded-2xl border border-dashed border-slate-300 bg-white/70 px-6 py-10 text-center', className)}>
      <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-50 text-brand-600" aria-hidden="true">
        <Icon className="h-6 w-6" />
      </span>
      <Heading className="mt-4 text-base font-semibold text-slate-900">{title}</Heading>
      {children && <div className="mt-1 max-w-md text-sm text-slate-600">{children}</div>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  )
}

/** Loading placeholder rows (announced to screen readers as loading). */
export function Skeleton({ rows = 3, label = 'Loading' }) {
  return (
    <div role="status" aria-label={label} className="space-y-3">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="h-12 animate-pulse rounded-xl bg-slate-200/60" />
      ))}
      <span className="sr-only">{label}…</span>
    </div>
  )
}

/** Displays a secret the server returns exactly once (join code or temporary password). */
export function OneTimeSecret({ label, value, onDismiss }) {
  const [copied, setCopied] = useState(false)

  async function copy() {
    try {
      await navigator.clipboard.writeText(value)
      setCopied(true)
    } catch {
      setCopied(false)
    }
  }

  return (
    <div className="space-y-3 rounded-2xl bg-amber-50 p-5 ring-1 ring-inset ring-amber-300" role="region" aria-label={label}>
      <div className="flex items-start gap-3">
        <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-800" aria-hidden="true">
          <KeyRound className="h-4 w-4" />
        </span>
        <p className="text-sm font-semibold text-amber-950">
          {label} — shown only once. Copy it now and share it securely; it cannot be displayed again.
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <code className="rounded-xl bg-white px-4 py-2 font-mono text-base tracking-wider text-slate-900 shadow-sm ring-1 ring-amber-200">{value}</code>
        <Button variant="secondary" icon={copied ? Check : Copy} onClick={copy}>
          {copied ? 'Copied' : 'Copy'}
        </Button>
        {onDismiss && (
          <Button variant="ghost" onClick={onDismiss}>
            I have saved it
          </Button>
        )}
      </div>
    </div>
  )
}
