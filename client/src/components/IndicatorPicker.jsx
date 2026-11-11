import { INDICATOR_TYPE_LABELS } from '../constants/caseStatus.js'
import { CheckboxField } from './ui.jsx'

const toggle = (list, value) => (list.includes(value) ? list.filter((item) => item !== value) : [...list, value])

/** Choose ACTIVE confirmed indicators to show in the advisory. */
export default function IndicatorPicker({ indicators, selected, onChange }) {
  if (indicators === null) return <p className="text-sm text-slate-500">Loading confirmed indicators…</p>
  return (
    <fieldset className="space-y-1">
      <legend className="text-sm font-medium text-slate-700">Confirmed indicators to include</legend>
      {indicators.length === 0 && <p className="text-sm text-slate-500">No active confirmed indicators in your registry.</p>}
      {indicators.map((item) => (
        <CheckboxField
          key={item.id}
          label={`${INDICATOR_TYPE_LABELS[item.type] ?? item.type}: ${item.value}`}
          checked={selected.includes(item.id)}
          onChange={() => onChange(toggle(selected, item.id))}
        />
      ))}
    </fieldset>
  )
}
