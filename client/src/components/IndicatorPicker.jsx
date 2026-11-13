import { INDICATOR_TYPE_LABELS } from '../constants/caseStatus.js'
import { CodeChip } from './ui/index.js'

const toggle = (list, value) => (list.includes(value) ? list.filter((item) => item !== value) : [...list, value])

/** Choose ACTIVE confirmed indicators to show in the advisory. */
export default function IndicatorPicker({ indicators, selected, onChange }) {
  if (indicators === null) return <p className="text-sm text-slate-500">Loading confirmed indicators…</p>
  return (
    <fieldset className="space-y-2">
      <legend className="text-sm font-medium text-slate-700">Confirmed indicators to include</legend>
      {indicators.length === 0 && <p className="text-sm text-slate-500">No active confirmed indicators in your registry.</p>}
      {indicators.length > 0 && (
        <ul className="divide-y divide-slate-100 rounded-xl ring-1 ring-slate-900/10">
          {indicators.map((item) => {
            const id = `indicator-${item.id}`
            return (
              <li key={item.id} className="flex items-center gap-3 px-3 py-2.5 transition hover:bg-slate-50">
                <input
                  id={id}
                  type="checkbox"
                  className="h-4 w-4 shrink-0 cursor-pointer rounded accent-accent-600"
                  checked={selected.includes(item.id)}
                  onChange={() => onChange(toggle(selected, item.id))}
                />
                <label htmlFor={id} className="flex min-w-0 flex-1 cursor-pointer flex-wrap items-center gap-2 text-sm text-slate-600">
                  <span>{`${INDICATOR_TYPE_LABELS[item.type] ?? item.type}: `}</span>
                  <CodeChip tone="danger">{item.value}</CodeChip>
                </label>
              </li>
            )
          })}
        </ul>
      )}
    </fieldset>
  )
}
