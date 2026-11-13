import { AtSign, Globe, Link2, Phone, Wallet } from 'lucide-react'
import { INDICATOR_TYPE_LABELS } from '../constants/caseStatus.js'
import { CodeChip } from './ui/index.js'

const TYPE_ORDER = ['domain', 'url', 'email', 'phone', 'upi']
const TYPE_ICONS = { domain: Globe, url: Link2, email: AtSign, phone: Phone, upi: Wallet }

/** Indicators grouped by type. Values are shown as inert chips, never as clickable links. */
export default function IndicatorList({ indicators }) {
  if (!indicators?.length) return <p className="text-sm text-slate-600">No contact details were found in this request.</p>

  return (
    <dl className="space-y-3">
      {TYPE_ORDER.filter((type) => indicators.some((item) => item.type === type)).map((type) => {
        const Icon = TYPE_ICONS[type]
        return (
          <div key={type}>
            <dt className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-slate-500">
              <Icon className="h-3.5 w-3.5" aria-hidden="true" />
              {INDICATOR_TYPE_LABELS[type]}
            </dt>
            <dd>
              <ul className="mt-1.5 flex flex-wrap gap-1.5">
                {indicators
                  .filter((item) => item.type === type)
                  .map((item) => (
                    <li key={`${item.type}:${item.value}`}>
                      <CodeChip title={item.source === 'student_entered' ? 'You entered this' : 'Found in your message or links'}>{item.value}</CodeChip>
                    </li>
                  ))}
              </ul>
            </dd>
          </div>
        )
      })}
    </dl>
  )
}
