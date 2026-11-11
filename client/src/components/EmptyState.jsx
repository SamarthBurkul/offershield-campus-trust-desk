/** Friendly empty list message with an optional action. */
export default function EmptyState({ title, children, action }) {
  return (
    <div className="rounded-lg border border-dashed border-slate-300 bg-white px-4 py-8 text-center">
      <p className="font-medium text-slate-800">{title}</p>
      {children && <p className="mt-1 text-sm text-slate-600">{children}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}
