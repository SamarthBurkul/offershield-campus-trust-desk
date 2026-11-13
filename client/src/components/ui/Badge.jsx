import clsx from 'clsx'

const TONES = {
  neutral: 'bg-slate-100 text-slate-700 ring-slate-500/15',
  brand: 'bg-brand-50 text-brand-800 ring-brand-700/15',
  accent: 'bg-accent-50 text-accent-800 ring-accent-700/15',
  info: 'bg-sky-50 text-sky-800 ring-sky-700/20',
  success: 'bg-emerald-50 text-emerald-800 ring-emerald-700/20',
  warning: 'bg-amber-50 text-amber-900 ring-amber-700/25',
  danger: 'bg-rose-50 text-rose-800 ring-rose-700/20',
  violet: 'bg-violet-50 text-violet-800 ring-violet-700/20',
}

const DOTS = {
  neutral: 'bg-slate-400',
  brand: 'bg-brand-600',
  accent: 'bg-accent-600',
  info: 'bg-sky-500',
  success: 'bg-emerald-500',
  warning: 'bg-amber-500',
  danger: 'bg-rose-500',
  violet: 'bg-violet-500',
}

/** Small pill. Tones carry meaning (success / warning / danger / info); use neutral otherwise. */
export function Badge({ tone = 'neutral', dot = false, size = 'md', icon: Icon, className, children, ...props }) {
  return (
    <span
      className={clsx(
        'inline-flex items-center gap-1.5 whitespace-nowrap rounded-full font-medium ring-1 ring-inset',
        size === 'sm' ? 'px-2 py-0.5 text-[11px]' : 'px-2.5 py-0.5 text-xs',
        TONES[tone] ?? TONES.neutral,
        className,
      )}
      {...props}
    >
      {dot && <span className={clsx('h-1.5 w-1.5 rounded-full', DOTS[tone] ?? DOTS.neutral)} aria-hidden="true" />}
      {Icon && <Icon className="h-3 w-3" aria-hidden="true" />}
      {children}
    </span>
  )
}

/** Account / college status (active, disabled, suspended, pending…). */
export function StatusBadge({ status }) {
  const tone = { active: 'success', pending_approval: 'warning', rejected: 'danger', suspended: 'neutral', disabled: 'neutral' }[status] ?? 'neutral'
  return (
    <Badge tone={tone} dot>
      {status}
    </Badge>
  )
}
