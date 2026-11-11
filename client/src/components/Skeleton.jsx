/** Loading placeholder rows (announced to screen readers as loading). */
export default function Skeleton({ rows = 3, label = 'Loading' }) {
  return (
    <div role="status" aria-label={label} className="space-y-3">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="h-12 animate-pulse rounded-md bg-slate-200/70" />
      ))}
      <span className="sr-only">{label}…</span>
    </div>
  )
}
