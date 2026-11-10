import { useId, useState } from 'react'

export function TextField({ label, hint, className = '', ...inputProps }) {
  const id = useId()
  return (
    <div className={`space-y-1 ${className}`}>
      <label htmlFor={id} className="block text-sm font-medium text-slate-700">
        {label}
      </label>
      <input
        id={id}
        className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-slate-900 shadow-sm focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-200"
        {...inputProps}
      />
      {hint && <p className="text-xs text-slate-500">{hint}</p>}
    </div>
  )
}

export function SelectField({ label, children, ...selectProps }) {
  const id = useId()
  return (
    <div className="space-y-1">
      <label htmlFor={id} className="block text-sm font-medium text-slate-700">
        {label}
      </label>
      <select
        id={id}
        className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-slate-900 shadow-sm focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-200"
        {...selectProps}
      >
        {children}
      </select>
    </div>
  )
}

export function Button({ variant = 'primary', className = '', ...props }) {
  const styles = {
    primary: 'bg-blue-700 text-white hover:bg-blue-800 disabled:bg-blue-300',
    secondary: 'border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 disabled:text-slate-400',
    danger: 'border border-red-300 bg-white text-red-700 hover:bg-red-50 disabled:text-red-300',
  }
  return (
    <button
      type="button"
      className={`rounded-md px-4 py-2 text-sm font-medium shadow-sm disabled:cursor-not-allowed ${styles[variant]} ${className}`}
      {...props}
    />
  )
}

export function ErrorAlert({ message }) {
  if (!message) return null
  return (
    <p role="alert" className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
      {message}
    </p>
  )
}

export function Card({ title, children }) {
  return (
    <section className="space-y-4 rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      {title && <h2 className="text-lg font-semibold text-slate-900">{title}</h2>}
      {children}
    </section>
  )
}

export function StatusBadge({ status }) {
  const active = status === 'active'
  return (
    <span
      className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${
        active ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-700'
      }`}
    >
      {status}
    </span>
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
    <div className="space-y-3 rounded-lg border border-amber-300 bg-amber-50 p-4" role="region" aria-label={label}>
      <p className="text-sm font-semibold text-amber-900">
        {label} — shown only once. Copy it now and share it securely; it cannot be displayed again.
      </p>
      <div className="flex flex-wrap items-center gap-3">
        <code className="rounded bg-white px-3 py-1.5 font-mono text-base tracking-wider text-slate-900 shadow-sm">
          {value}
        </code>
        <Button variant="secondary" onClick={copy}>
          {copied ? 'Copied' : 'Copy'}
        </Button>
        {onDismiss && (
          <Button variant="secondary" onClick={onDismiss}>
            I have saved it
          </Button>
        )}
      </div>
    </div>
  )
}
