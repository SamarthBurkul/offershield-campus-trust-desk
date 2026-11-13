import clsx from 'clsx'
import { Check } from 'lucide-react'

const YEARS = [1, 2, 3, 4, 5]
const toggle = (list, value) => (list.includes(value) ? list.filter((item) => item !== value) : [...list, value])

/** A checkbox drawn as a toggle chip (keyboard and screen readers still get a real checkbox). */
function ChipToggle({ label, checked, onChange }) {
  return (
    <label
      className={clsx(
        'inline-flex cursor-pointer select-none items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium ring-1 ring-inset transition-colors duration-150 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-accent-500',
        checked ? 'bg-accent-600 text-white ring-accent-600' : 'bg-white text-slate-700 ring-slate-300 hover:bg-slate-50',
      )}
    >
      <input type="checkbox" className="sr-only" checked={checked} onChange={onChange} />
      {checked && <Check className="h-3.5 w-3.5" aria-hidden="true" />}
      {label}
    </label>
  )
}

/** Advisory audience: year and branch chips; nothing selected means everyone. */
export default function TargetPicker({ value, branches = [], onChange }) {
  return (
    <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
      <fieldset className="space-y-2">
        <legend className="text-sm font-medium text-slate-700">
          Years {value.years.length === 0 && <span className="font-normal text-slate-500">(All years)</span>}
        </legend>
        <div className="flex flex-wrap gap-2">
          {YEARS.map((year) => (
            <ChipToggle key={year} label={`Year ${year}`} checked={value.years.includes(year)} onChange={() => onChange({ ...value, years: toggle(value.years, year).sort() })} />
          ))}
        </div>
      </fieldset>
      <fieldset className="space-y-2">
        <legend className="text-sm font-medium text-slate-700">
          Branches {value.branches.length === 0 && <span className="font-normal text-slate-500">(All branches)</span>}
        </legend>
        <div className="flex flex-wrap gap-2">
          {branches.map((branch) => (
            <ChipToggle key={branch} label={branch} checked={value.branches.includes(branch)} onChange={() => onChange({ ...value, branches: toggle(value.branches, branch) })} />
          ))}
        </div>
      </fieldset>
    </div>
  )
}
