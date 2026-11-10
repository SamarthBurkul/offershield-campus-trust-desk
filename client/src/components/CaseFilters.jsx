import { useState } from 'react'
import { CHANNEL_LABELS, PRIORITY_LABELS, QUEUE_TABS } from '../constants/caseStatus.js'
import { Button, SelectField, TextField } from './ui.jsx'

/**
 * Queue tabs, filters and search. `values` mirrors the URL search params; `onChange(patch)`
 * merges a partial update (and the page resets to 1).
 */
export default function CaseFilters({ values, onChange }) {
  const [search, setSearch] = useState(values.q ?? '')

  return (
    <div className="space-y-4">
      <div role="tablist" aria-label="Case status" className="flex flex-wrap gap-2">
        {QUEUE_TABS.map((tab) => {
          const selected = (values.status || 'open') === tab.value
          return (
            <button
              key={tab.value}
              type="button"
              role="tab"
              aria-selected={selected}
              onClick={() => onChange({ status: tab.value })}
              className={`rounded-full px-3 py-1.5 text-sm font-medium ${
                selected ? 'bg-blue-700 text-white' : 'bg-white text-slate-700 ring-1 ring-slate-300 hover:bg-slate-50'
              }`}
            >
              {tab.label}
            </button>
          )
        })}
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <SelectField label="Priority" value={values.priority ?? ''} onChange={(event) => onChange({ priority: event.target.value })}>
          <option value="">Any priority</option>
          {Object.entries(PRIORITY_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </SelectField>
        <SelectField label="Assignee" value={values.assignee ?? ''} onChange={(event) => onChange({ assignee: event.target.value })}>
          <option value="">Anyone</option>
          <option value="me">Me</option>
          <option value="unassigned">Unassigned</option>
        </SelectField>
        <SelectField label="Channel" value={values.channel ?? ''} onChange={(event) => onChange({ channel: event.target.value })}>
          <option value="">Any channel</option>
          {Object.entries(CHANNEL_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </SelectField>
      </div>

      <form
        className="flex flex-wrap items-end gap-3"
        onSubmit={(event) => {
          event.preventDefault()
          onChange({ q: search.trim() })
        }}
      >
        <TextField
          label="Search cases"
          className="min-w-64 flex-1"
          hint="Case number, company, phone, UPI ID or domain"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
        <Button type="submit">Search</Button>
        {values.q && (
          <Button
            variant="secondary"
            onClick={() => {
              setSearch('')
              onChange({ q: '' })
            }}
          >
            Clear
          </Button>
        )}
      </form>
    </div>
  )
}
