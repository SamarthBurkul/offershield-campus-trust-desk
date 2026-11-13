import { STAFF_STATUS_LABELS, STATUS_TONES, STUDENT_STATUS_LABELS } from '../constants/caseStatus.js'
import { Badge } from './ui/index.js'

/** Case status badge. Students see plain-language wording; staff see the workflow names. */
export default function StatusBadge({ status, audience = 'student', size }) {
  const labels = audience === 'staff' ? STAFF_STATUS_LABELS : STUDENT_STATUS_LABELS
  return (
    <Badge tone={STATUS_TONES[status] ?? 'neutral'} dot size={size}>
      {labels[status] ?? status}
    </Badge>
  )
}
