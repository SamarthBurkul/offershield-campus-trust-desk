import { useId } from 'react'
import { Button } from './ui.jsx'

/** Editable list of short text values (links, emails, phones, UPI IDs) with add/remove buttons. */
export default function ListInput({ label, values, onChange, max, placeholder, type = 'text', hint }) {
  const id = useId()
  const update = (index, value) => onChange(values.map((item, i) => (i === index ? value : item)))
  const remove = (index) => onChange(values.filter((_, i) => i !== index))

  return (
    <fieldset className="space-y-2">
      <legend className="text-sm font-medium text-slate-700">{label}</legend>
      {values.map((value, index) => (
        <div key={index} className="flex gap-2">
          <input
            id={`${id}-${index}`}
            type={type}
            aria-label={`${label} ${index + 1}`}
            className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-slate-900 shadow-sm focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-200"
            placeholder={placeholder}
            value={value}
            onChange={(event) => update(index, event.target.value)}
          />
          <Button variant="secondary" aria-label={`Remove ${label} ${index + 1}`} onClick={() => remove(index)}>
            Remove
          </Button>
        </div>
      ))}
      {values.length < max && (
        <Button variant="secondary" onClick={() => onChange([...values, ''])}>
          Add {label.toLowerCase().replace(/s$/, '')}
        </Button>
      )}
      {hint && <p className="text-xs text-slate-500">{hint}</p>}
    </fieldset>
  )
}
