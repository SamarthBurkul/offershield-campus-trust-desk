import { useEffect, useId, useState } from 'react'
import { listStaffMembers } from '../api/staff.js'
import { ROLE_LABELS, ROLES } from '../auth/roles.js'
import { Button } from './ui.jsx'

/**
 * TPO head: choose any active staff member. Placement officer: "Assign to me" / "Unassign" only.
 * Disabled for closed cases.
 */
export default function AssigneeSelect({ user, assignee, disabled, onAssign }) {
  const id = useId()
  const isHead = user.role === ROLES.TPO_HEAD
  const [staff, setStaff] = useState([])

  useEffect(() => {
    if (!isHead) return undefined
    let active = true
    listStaffMembers()
      .then((members) => active && setStaff(members.filter((member) => member.status === 'active')))
      .catch(() => active && setStaff([]))
    return () => {
      active = false
    }
  }, [isHead])

  if (isHead) {
    return (
      <div className="flex items-center gap-2 text-sm">
        <label htmlFor={id} className="font-medium text-slate-700">
          Assignee
        </label>
        <select
          id={id}
          disabled={disabled}
          value={assignee?.id ?? ''}
          onChange={(event) => onAssign(event.target.value || null)}
          className="rounded-md border border-slate-300 bg-white px-2 py-1.5 text-slate-900"
        >
          <option value="">Unassigned</option>
          {assignee && !staff.some((member) => member.id === assignee.id) && <option value={assignee.id}>{assignee.name}</option>}
          {staff.map((member) => (
            <option key={member.id} value={member.id}>
              {member.name} ({ROLE_LABELS[member.role]})
            </option>
          ))}
        </select>
      </div>
    )
  }

  const mine = assignee?.id === user.id
  return (
    <div className="flex flex-wrap items-center gap-2 text-sm">
      <span className="text-slate-700">
        Assignee: <span className="font-medium text-slate-900">{assignee ? (mine ? 'You' : assignee.name) : 'Unassigned'}</span>
      </span>
      {!mine && (
        <Button variant="secondary" disabled={disabled} onClick={() => onAssign(user.id)}>
          Assign to me
        </Button>
      )}
      {mine && (
        <Button variant="secondary" disabled={disabled} onClick={() => onAssign(null)}>
          Unassign
        </Button>
      )}
    </div>
  )
}
