import clsx from 'clsx'
import { AlertOctagon, AlertTriangle, Info } from 'lucide-react'
import { INDICATOR_TYPE_LABELS } from '../constants/caseStatus.js'
import { formatDate } from '../utils/format.js'
import { CodeChip } from './ui/index.js'

const SEVERITY = Object.freeze({
  critical: { box: 'bg-rose-50 ring-rose-600/25 text-rose-950', stripe: 'bg-rose-500', icon: AlertOctagon, iconClass: 'text-rose-600', label: 'Critical' },
  warning: { box: 'bg-amber-50 ring-amber-600/30 text-amber-950', stripe: 'bg-amber-500', icon: AlertTriangle, iconClass: 'text-amber-600', label: 'Warning' },
  info: { box: 'bg-sky-50 ring-sky-600/25 text-sky-950', stripe: 'bg-sky-500', icon: Info, iconClass: 'text-sky-600', label: 'Information' },
})

/** How an advisory looks to students (also used as the staff "Preview as student"). */
export default function AdvisoryCard({ advisory, children }) {
  const style = SEVERITY[advisory.severity] ?? SEVERITY.info
  const Icon = style.icon
  return (
    <article className={clsx('relative overflow-hidden rounded-2xl ring-1 ring-inset', style.box)} aria-label={advisory.title}>
      <span className={clsx('absolute inset-y-0 left-0 w-1.5', style.stripe)} aria-hidden="true" />
      <div className="space-y-3 py-4 pl-6 pr-5">
        <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider opacity-90">
          <Icon className={clsx('h-4 w-4', style.iconClass)} aria-hidden="true" />
          {style.label} advisory
        </p>
        <h3 className="text-lg font-semibold tracking-tight">{advisory.title}</h3>
        <p className="whitespace-pre-wrap text-[15px] leading-7">{advisory.body}</p>
        {advisory.indicators?.length > 0 && (
          <div className="space-y-1.5 text-sm">
            <p className="font-medium">Confirmed by your placement cell:</p>
            <ul className="flex flex-wrap gap-2">
              {advisory.indicators.map((item) => (
                <li key={`${item.type}:${item.value}`}>
                  <CodeChip tone="light">
                    {INDICATOR_TYPE_LABELS[item.type] ?? item.type}: {item.value}
                  </CodeChip>
                </li>
              ))}
            </ul>
          </div>
        )}
        {advisory.publishedAt && <p className="text-xs opacity-70">Published {formatDate(advisory.publishedAt)}</p>}
        {children}
      </div>
    </article>
  )
}
