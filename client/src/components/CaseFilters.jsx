import { Search, X } from 'lucide-react'
import { useState } from 'react'
import { CHANNEL_LABELS, PRIORITY_LABELS, QUEUE_TABS } from '../constants/caseStatus.js'
import { Button, SelectField, Tabs, TextField } from './ui/index.js'

/**
 * Queue tabs (with counts when known), filters and search. `values` mirrors the URL search params;
 * `onChange(patch)` merges a partial update (and the page resets to 1).
 */
export default function CaseFilters({ values, onChange, counts }) {
  const [search, setSearch] = useState(values.q ?? '')

  return (
    <div className="space-y-4">
      <Tabs
        label="Case status"
        value={values.status || 'open'}
        onChange={(status) => onChange({ status })}
        tabs={QUEUE_TABS.map((tab) => ({ ...tab, count: counts?.[tab.value] }))}
      />

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-[minmax(0,2fr)_repeat(3,minmax(0,1fr))] lg:items-end">
        <form
          className="flex items-end gap-2"
          onSubmit={(event) => {
            event.preventDefault()
            onChange({ q: search.trim() })
          }}
        >
          <TextField
            label="Search cases"
            className="min-w-0 flex-1"
            placeholder="Case number, company, phone, UPI ID or domain"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
          <Button type="submit" icon={Search}>
            Search
          </Button>
          {values.q && (
            <Button
              variant="ghost"
              icon={X}
              onClick={() => {
                setSearch('')
                onChange({ q: '' })
              }}
            >
              Clear
            </Button>
          )}
        </form>
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
    </div>
  )
}
