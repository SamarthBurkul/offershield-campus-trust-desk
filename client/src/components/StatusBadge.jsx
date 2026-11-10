import { STAFF_STATUS_LABELS, STATUS_BADGE_CLASSES, STUDENT_STATUS_LABELS } from '../constants/caseStatus.js'

/** Case status badge. Students see plain-language wording; staff see the workflow names. */
export default function StatusBadge({ status, audience = 'student' }) {
  const labels = audience === 'staff' ? STAFF_STATUS_LABELS : STUDENT_STATUS_LABELS
  return (
    <span
      className={`inline-block whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium ${
        STATUS_BADGE_CLASSES[status] ?? 'bg-slate-100 text-slate-800'
      }`}
    >
      {labels[status] ?? status}
    </span>
  )
}
