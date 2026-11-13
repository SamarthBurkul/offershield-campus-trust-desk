import { formatNumber } from '../utils/format.js'

/** Horizontal CSS bars (no chart library): rows of { label, value }, each with its value label. */
export default function BarRows({ title, rows, hint }) {
  const max = Math.max(1, ...rows.map((row) => row.value))
  const total = rows.reduce((sum, row) => sum + row.value, 0)
  return (
    <section className="space-y-3" aria-label={title}>
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
        <span className="text-xs text-slate-500 tabular-nums">{formatNumber(total)} total</span>
      </div>
      {hint && <p className="-mt-2 text-xs text-slate-500">{hint}</p>}
      <ul className="space-y-2">
        {rows.map((row) => (
          <li key={row.label} className="grid grid-cols-[minmax(6rem,9rem)_1fr_2.5rem] items-center gap-3 text-sm">
            <span className="truncate text-slate-600" title={row.label}>
              {row.label}
            </span>
            <span className="h-2.5 overflow-hidden rounded-full bg-slate-100">
              <span
                className="block h-full rounded-full bg-gradient-to-r from-accent-500 to-brand-600 transition-[width] duration-200"
                style={{ width: `${(row.value / max) * 100}%` }}
                data-testid="bar"
              />
            </span>
            <span className="text-right font-medium tabular-nums text-slate-900">{row.value}</span>
          </li>
        ))}
      </ul>
    </section>
  )
}
