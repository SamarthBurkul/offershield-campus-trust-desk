import { useId } from 'react'
import { Plus, X } from 'lucide-react'
import { Button, IconButton, Input } from './ui/index.js'

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
          <Input
            id={`${id}-${index}`}
            type={type}
            aria-label={`${label} ${index + 1}`}
            placeholder={placeholder}
            value={value}
            onChange={(event) => update(index, event.target.value)}
          />
          <IconButton icon={X} variant="secondary" label={`Remove ${label} ${index + 1}`} onClick={() => remove(index)} />
        </div>
      ))}
      {values.length < max && (
        <Button variant="ghost" size="sm" icon={Plus} onClick={() => onChange([...values, ''])}>
          Add {label.toLowerCase().replace(/s$/, '')}
        </Button>
      )}
      {hint && <p className="text-xs text-slate-500">{hint}</p>}
    </fieldset>
  )
}
