import { INDICATOR_TYPE_LABELS } from '../constants/caseStatus.js'

const SEVERITY_STYLES = Object.freeze({
  critical: 'border-red-300 bg-red-50 text-red-950',
  warning: 'border-amber-300 bg-amber-50 text-amber-950',
  info: 'border-blue-200 bg-blue-50 text-blue-950',
})

const SEVERITY_LABELS = { critical: 'Critical', warning: 'Warning', info: 'Information' }

/** How an advisory looks to students (also used as the staff "Preview as student"). */
export default function AdvisoryCard({ advisory, children }) {
  return (
    <article className={`space-y-2 rounded-lg border p-4 ${SEVERITY_STYLES[advisory.severity] ?? SEVERITY_STYLES.info}`} aria-label={advisory.title}>
      <p className="text-xs font-semibold uppercase tracking-wide opacity-80">{SEVERITY_LABELS[advisory.severity] ?? 'Advisory'} advisory</p>
      <h3 className="text-base font-semibold">{advisory.title}</h3>
      <p className="whitespace-pre-wrap text-sm">{advisory.body}</p>
      {advisory.indicators?.length > 0 && (
        <div className="text-sm">
          <p className="font-medium">Confirmed by your placement cell:</p>
          <ul className="mt-1 flex flex-wrap gap-2">
            {advisory.indicators.map((item) => (
              <li key={`${item.type}:${item.value}`} className="break-all rounded bg-white/70 px-2 py-0.5 font-mono text-xs">
                {INDICATOR_TYPE_LABELS[item.type] ?? item.type}: {item.value}
              </li>
            ))}
          </ul>
        </div>
      )}
      {advisory.publishedAt && <p className="text-xs opacity-70">Published {new Date(advisory.publishedAt).toLocaleDateString()}</p>}
      {children}
    </article>
  )
}
