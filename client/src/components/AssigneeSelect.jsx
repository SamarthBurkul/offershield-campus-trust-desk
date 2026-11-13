import { useEffect, useId, useState } from 'react'
import { listStaffMembers } from '../api/staff.js'
import { ROLE_LABELS, ROLES } from '../auth/roles.js'
import { UserCheck, UserMinus } from 'lucide-react'
import { Avatar, Button } from './ui/index.js'

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
        {assignee && <Avatar name={assignee.name} size="sm" />}
        <label htmlFor={id} className="font-medium text-slate-600">
          Assignee
        </label>
        <select
          id={id}
          disabled={disabled}
          value={assignee?.id ?? ''}
          onChange={(event) => onAssign(event.target.value || null)}
          className="h-9 w-full max-w-[13rem] min-w-0 rounded-xl border-0 bg-white pl-3 pr-8 text-sm text-slate-900 shadow-sm ring-1 ring-inset ring-slate-300 hover:ring-slate-400 focus:outline-none focus:ring-2 focus:ring-accent-500 disabled:bg-slate-50 disabled:text-slate-500"
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
      {assignee && <Avatar name={assignee.name} size="sm" />}
      <span className="text-slate-600">
        Assignee: <span className="font-medium text-slate-900">{assignee ? (mine ? 'You' : assignee.name) : 'Unassigned'}</span>
      </span>
      {!mine && (
        <Button variant="secondary" size="sm" icon={UserCheck} disabled={disabled} onClick={() => onAssign(user.id)}>
          Assign to me
        </Button>
      )}
      {mine && (
        <Button variant="secondary" size="sm" icon={UserMinus} disabled={disabled} onClick={() => onAssign(null)}>
          Unassign
        </Button>
      )}
    </div>
  )
}
