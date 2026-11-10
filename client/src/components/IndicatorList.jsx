import { INDICATOR_TYPE_LABELS } from '../constants/caseStatus.js'

const TYPE_ORDER = ['domain', 'url', 'email', 'phone', 'upi']

/** Indicators grouped by type. Values are shown as inert text, never as clickable links. */
export default function IndicatorList({ indicators }) {
  if (!indicators?.length) return <p className="text-sm text-slate-600">No contact details were found in this request.</p>

  return (
    <dl className="space-y-3">
      {TYPE_ORDER.filter((type) => indicators.some((item) => item.type === type)).map((type) => (
        <div key={type}>
          <dt className="text-sm font-medium text-slate-700">{INDICATOR_TYPE_LABELS[type]}</dt>
          <dd>
            <ul className="mt-1 flex flex-wrap gap-2">
              {indicators
                .filter((item) => item.type === type)
                .map((item) => (
                  <li
                    key={`${item.type}:${item.value}`}
                    className="break-all rounded bg-slate-100 px-2 py-1 font-mono text-xs text-slate-800"
                    title={item.source === 'student_entered' ? 'You entered this' : 'Found in your message or links'}
                  >
                    {item.value}
                  </li>
                ))}
            </ul>
          </dd>
        </div>
      ))}
    </dl>
  )
}
