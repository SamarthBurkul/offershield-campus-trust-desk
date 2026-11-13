import clsx from 'clsx'
import { useId } from 'react'

const CONTROL =
  'block w-full rounded-xl border-0 bg-white px-3.5 text-sm text-slate-900 shadow-sm ring-1 ring-inset ring-slate-300 transition duration-150 placeholder:text-slate-400 hover:ring-slate-400 focus:outline-none focus:ring-2 focus:ring-accent-500 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-500'
const INVALID = 'ring-rose-400 hover:ring-rose-500 focus:ring-rose-500'

/**
 * Label + control + hint/error. The required marker is drawn with CSS so it never changes the label's text
 * (accessible name). Pass the control's id as `htmlFor`.
 */
export function Field({ label, htmlFor, hint, error, required, className, labelClassName, children }) {
  return (
    <div className={clsx('space-y-1.5', className)}>
      {label && (
        <label
          htmlFor={htmlFor}
          className={clsx(
            'block text-sm font-medium text-slate-700',
            required && "after:ml-0.5 after:text-rose-500 after:content-['*']",
            labelClassName,
          )}
        >
          {label}
        </label>
      )}
      {children}
      {error ? (
        <p className="text-xs font-medium text-rose-700">{error}</p>
      ) : (
        hint && <p className="text-xs leading-5 text-slate-500">{hint}</p>
      )}
    </div>
  )
}

export function Input({ className, invalid, ...props }) {
  return <input className={clsx(CONTROL, 'h-10', invalid && INVALID, className)} aria-invalid={invalid || undefined} {...props} />
}

export function Textarea({ className, invalid, ...props }) {
  return <textarea className={clsx(CONTROL, 'py-2.5 leading-6', invalid && INVALID, className)} aria-invalid={invalid || undefined} {...props} />
}

export function Select({ className, invalid, children, ...props }) {
  return (
    <select className={clsx(CONTROL, 'h-10 pr-9', invalid && INVALID, className)} aria-invalid={invalid || undefined} {...props}>
      {children}
    </select>
  )
}

/** Checkbox with its label (and optional hint). The label is the accessible name. */
export function Checkbox({ label, hint, className, ...inputProps }) {
  const id = useId()
  return (
    <div className={clsx('flex items-start gap-2.5', className)}>
      <input
        id={id}
        type="checkbox"
        className="mt-0.5 h-4 w-4 shrink-0 cursor-pointer rounded border-slate-300 accent-accent-600 disabled:cursor-not-allowed"
        {...inputProps}
      />
      <div className="min-w-0">
        <label htmlFor={id} className="cursor-pointer text-sm leading-5 text-slate-800">
          {label}
        </label>
        {hint && <p className="text-xs text-slate-500">{hint}</p>}
      </div>
    </div>
  )
}

/** Radio group: options [{ value, label, hint? }]. */
export function RadioGroup({ legend, name, value, options, onChange, className }) {
  const id = useId()
  return (
    <fieldset className={clsx('space-y-2', className)}>
      {legend && <legend className="text-sm font-medium text-slate-700">{legend}</legend>}
      {options.map((option) => (
        <div key={option.value} className="flex items-start gap-2.5">
          <input
            id={`${id}-${option.value}`}
            type="radio"
            name={name ?? id}
            value={option.value}
            checked={value === option.value}
            onChange={() => onChange(option.value)}
            className="mt-0.5 h-4 w-4 shrink-0 cursor-pointer accent-accent-600"
          />
          <label htmlFor={`${id}-${option.value}`} className="cursor-pointer text-sm text-slate-800">
            {option.label}
            {option.hint && <span className="block text-xs text-slate-500">{option.hint}</span>}
          </label>
        </div>
      ))}
    </fieldset>
  )
}

/* Convenience wrappers (the pre-Phase-8 API, kept so every form keeps its labels and behaviour). */

export function TextField({ label, hint, error, className, required, ...inputProps }) {
  const id = useId()
  return (
    <Field label={label} htmlFor={id} hint={hint} error={error} required={required} className={className}>
      <Input id={id} required={required} invalid={Boolean(error)} {...inputProps} />
    </Field>
  )
}

export function SelectField({ label, hint, error, className, children, ...selectProps }) {
  const id = useId()
  return (
    <Field label={label} htmlFor={id} hint={hint} error={error} className={className}>
      <Select id={id} invalid={Boolean(error)} {...selectProps}>
        {children}
      </Select>
    </Field>
  )
}

export function TextAreaField({ label, hint, error, rows = 5, className, ...textareaProps }) {
  const id = useId()
  return (
    <Field label={label} htmlFor={id} hint={hint} error={error} className={className}>
      <Textarea id={id} rows={rows} invalid={Boolean(error)} {...textareaProps} />
    </Field>
  )
}

export const CheckboxField = Checkbox
