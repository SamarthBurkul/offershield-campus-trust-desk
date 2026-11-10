import { STATUS_BADGE_CLASSES, STUDENT_STATUS_LABELS } from '../constants/caseStatus.js'

/** Case status badge with student-facing wording. */
export default function StatusBadge({ status }) {
  return (
    <span
      className={`inline-block whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium ${
        STATUS_BADGE_CLASSES[status] ?? 'bg-slate-100 text-slate-800'
      }`}
    >
      {STUDENT_STATUS_LABELS[status] ?? status}
    </span>
  )
}
