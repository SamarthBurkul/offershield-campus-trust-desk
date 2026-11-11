import { CheckboxField } from './ui.jsx'

const YEARS = [1, 2, 3, 4, 5]
const toggle = (list, value) => (list.includes(value) ? list.filter((item) => item !== value) : [...list, value])

/** Advisory audience: year and branch checkboxes; nothing selected means everyone. */
export default function TargetPicker({ value, branches = [], onChange }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <fieldset className="space-y-1">
        <legend className="text-sm font-medium text-slate-700">Years {value.years.length === 0 && <span className="font-normal text-slate-500">(All years)</span>}</legend>
        <div className="flex flex-wrap gap-x-4 gap-y-1">
          {YEARS.map((year) => (
            <CheckboxField key={year} label={`Year ${year}`} checked={value.years.includes(year)} onChange={() => onChange({ ...value, years: toggle(value.years, year).sort() })} />
          ))}
        </div>
      </fieldset>
      <fieldset className="space-y-1">
        <legend className="text-sm font-medium text-slate-700">Branches {value.branches.length === 0 && <span className="font-normal text-slate-500">(All branches)</span>}</legend>
        <div className="flex flex-wrap gap-x-4 gap-y-1">
          {branches.map((branch) => (
            <CheckboxField key={branch} label={branch} checked={value.branches.includes(branch)} onChange={() => onChange({ ...value, branches: toggle(value.branches, branch) })} />
          ))}
        </div>
      </fieldset>
    </div>
  )
}
