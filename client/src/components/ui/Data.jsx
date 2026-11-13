import clsx from 'clsx'

/** Monospace chip for inert technical values: domains, UPI IDs, phones, case numbers. Never a link. */
export function CodeChip({ tone = 'neutral', className, children, ...props }) {
  const tones = {
    neutral: 'bg-slate-100 text-slate-800 ring-slate-900/10',
    danger: 'bg-rose-50 text-rose-900 ring-rose-600/20',
    success: 'bg-emerald-50 text-emerald-900 ring-emerald-600/20',
    light: 'bg-white/80 text-slate-900 ring-slate-900/10',
  }
  return (
    <span
      className={clsx('inline-block max-w-full break-all rounded-md px-1.5 py-0.5 font-mono text-xs ring-1 ring-inset', tones[tone] ?? tones.neutral, className)}
      {...props}
    >
      {children}
    </span>
  )
}

/** Definition list: items [{ term, value }] (falsy items are skipped). */
export function KeyValueList({ items, columns = 1, className }) {
  return (
    <dl className={clsx('grid grid-cols-1 gap-x-6 gap-y-3 text-sm', columns === 2 && 'sm:grid-cols-2', columns === 3 && 'sm:grid-cols-3', className)}>
      {items.filter(Boolean).map((item) => (
        <div key={item.term} className="min-w-0">
          <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">{item.term}</dt>
          <dd className="mt-0.5 break-words text-slate-900">{item.value}</dd>
        </div>
      ))}
    </dl>
  )
}

/** Horizontal progress (0–1). `label` names it for assistive technology. */
export function ProgressBar({ value = 0, label, tone = 'accent', className }) {
  const pct = Math.max(0, Math.min(100, Math.round((value ?? 0) * 100)))
  const fill = { accent: 'bg-accent-600', success: 'bg-emerald-500', warning: 'bg-amber-500', danger: 'bg-rose-500' }[tone] ?? 'bg-accent-600'
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={pct}
      className={clsx('h-2 w-full overflow-hidden rounded-full bg-slate-100', className)}
    >
      <div className={clsx('h-full rounded-full transition-[width] duration-200', fill)} style={{ width: `${pct}%` }} />
    </div>
  )
}

const STAT_TONES = {
  brand: 'bg-brand-50 text-brand-700',
  accent: 'bg-accent-50 text-accent-700',
  danger: 'bg-rose-50 text-rose-700',
  warning: 'bg-amber-50 text-amber-700',
  success: 'bg-emerald-50 text-emerald-700',
  info: 'bg-sky-50 text-sky-700',
}

/** One headline number with an icon, label and a one-line explanation. */
export function StatCard({ label, value, hint, icon: Icon, tone = 'brand', className }) {
  return (
    <div className={clsx('rounded-2xl bg-white p-5 shadow-card ring-1 ring-slate-900/5', className)}>
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-medium text-slate-600">{label}</p>
        {Icon && (
          <span className={clsx('inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg', STAT_TONES[tone] ?? STAT_TONES.brand)} aria-hidden="true">
            <Icon className="h-4 w-4" />
          </span>
        )}
      </div>
      <p className="mt-2 text-3xl font-semibold tracking-tight text-slate-900 tabular-nums">{value ?? '–'}</p>
      {hint && <p className="mt-1 text-xs leading-5 text-slate-500">{hint}</p>}
    </div>
  )
}
