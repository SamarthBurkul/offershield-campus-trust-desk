import { ROLE_LABELS } from '../auth/roles.js'
import { DECISION_TYPE_LABELS, STAFF_STATUS_LABELS } from '../constants/caseStatus.js'

const STUDENT_ACTOR_LABELS = { student: 'You', placement_cell: 'Placement cell', system: 'OfferShield' }

function describe(event, staff) {
  switch (event.type) {
    case 'created':
      return staff ? 'Request submitted by the student' : 'Request submitted'
    case 'student_message':
      return staff ? 'Student replied' : 'You replied'
    case 'evidence_added':
      return event.metadata?.count ? `Evidence added (${event.metadata.count} file${event.metadata.count === 1 ? '' : 's'})` : 'Evidence added'
    case 'status_changed':
      return staff && event.metadata?.to ? `Status changed to "${STAFF_STATUS_LABELS[event.metadata.to] ?? event.metadata.to}"` : 'Status updated'
    case 'info_requested':
      return staff ? 'Information requested from the student' : 'The placement cell asked for more information'
    case 'staff_message':
      return staff ? 'Message to the student' : 'Message from the placement cell'
    case 'assigned':
      return event.metadata?.to ? 'Case assigned' : 'Case unassigned'
    case 'recommendation_made':
      return `Recommendation: ${DECISION_TYPE_LABELS[event.metadata?.type] ?? 'recorded'}`
    case 'decision_recorded':
      return staff && event.metadata?.type ? `Decision recorded: ${DECISION_TYPE_LABELS[event.metadata.type]}` : 'Decision recorded'
    case 'reopened':
      return 'Request reopened'
    default:
      return 'Update'
  }
}

function actorLabel(event) {
  if (typeof event.actor === 'string') return STUDENT_ACTOR_LABELS[event.actor] ?? 'OfferShield'
  if (!event.actor) return 'OfferShield'
  const role = ROLE_LABELS[event.actor.role] ?? event.actor.role
  return event.actor.name ? `${event.actor.name}${role ? ` (${role})` : ''}` : role ?? 'OfferShield'
}

/**
 * Case timeline. Students get only visible events from the server; staff pass showVisibility to
 * see which events the student can read and which are internal.
 */
export default function CaseTimeline({ events, showVisibility = false }) {
  if (!events?.length) return <p className="text-sm text-slate-600">No activity yet.</p>

  return (
    <ol className="space-y-4 border-l-2 border-slate-200 pl-4" aria-label="Timeline">
      {events.map((event) => (
        <li key={event.id} className="relative">
          <span
            className={`absolute -left-[1.4rem] top-1.5 h-2.5 w-2.5 rounded-full ${
              showVisibility && !event.visibleToStudent ? 'bg-slate-400' : 'bg-blue-600'
            }`}
            aria-hidden="true"
          />
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-medium text-slate-900">{describe(event, showVisibility)}</p>
            {showVisibility &&
              (event.visibleToStudent ? (
                <span className="rounded bg-blue-50 px-1.5 py-0.5 text-xs font-medium text-blue-800">Visible to student</span>
              ) : (
                <span className="rounded bg-slate-200 px-1.5 py-0.5 text-xs font-medium text-slate-700">Internal</span>
              ))}
          </div>
          <p className="text-xs text-slate-500">
            {actorLabel(event)} · {new Date(event.createdAt).toLocaleString()}
          </p>
          {event.body && <p className="mt-1 whitespace-pre-wrap text-sm text-slate-700">{event.body}</p>}
          {showVisibility && event.type === 'reopened' && event.metadata?.reason && (
            <p className="mt-1 text-sm text-slate-600">
              <span className="font-medium">Reason (internal):</span> {event.metadata.reason}
            </p>
          )}
        </li>
      ))}
    </ol>
  )
}
