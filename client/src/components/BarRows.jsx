/** Horizontal CSS bars (no chart library): rows of { label, value }. */
export default function BarRows({ title, rows, hint }) {
  const max = Math.max(1, ...rows.map((row) => row.value))
  return (
    <section className="space-y-2" aria-label={title}>
      <h3 className="text-sm font-semibold text-slate-800">{title}</h3>
      {hint && <p className="text-xs text-slate-500">{hint}</p>}
      <ul className="space-y-1.5">
        {rows.map((row) => (
          <li key={row.label} className="grid grid-cols-[minmax(6rem,9rem)_1fr_2.5rem] items-center gap-2 text-sm">
            <span className="truncate text-slate-700">{row.label}</span>
            <span className="h-3 rounded bg-slate-100">
              <span className="block h-3 rounded bg-blue-600" style={{ width: `${(row.value / max) * 100}%` }} data-testid="bar" />
            </span>
            <span className="text-right font-medium tabular-nums text-slate-900">{row.value}</span>
          </li>
        ))}
      </ul>
    </section>
  )
}
