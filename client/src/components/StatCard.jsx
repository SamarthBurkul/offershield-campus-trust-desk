/** One headline number with a one-line explanation. */
export default function StatCard({ label, value, hint }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-2xl font-bold text-slate-900">{value ?? '–'}</p>
      <p className="text-sm font-medium text-slate-700">{label}</p>
      {hint && <p className="mt-1 text-xs text-slate-500">{hint}</p>}
    </div>
  )
}
