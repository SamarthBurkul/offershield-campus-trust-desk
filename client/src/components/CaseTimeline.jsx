import { STUDENT_STATUS_LABELS } from '../constants/caseStatus.js'

const ACTOR_LABELS = { student: 'You', placement_cell: 'Placement cell', system: 'OfferShield' }

function describe(event) {
  switch (event.type) {
    case 'created':
      return 'Request submitted'
    case 'student_message':
      return 'You replied'
    case 'evidence_added':
      return `Evidence added (${event.metadata?.count ?? 1} file${event.metadata?.count === 1 ? '' : 's'})`
    case 'status_changed':
      return `Status changed to "${STUDENT_STATUS_LABELS[event.metadata?.to] ?? event.metadata?.to}"`
    case 'info_requested':
      return 'The placement cell asked for more information'
    case 'staff_message':
      return 'Message from the placement cell'
    case 'decision_recorded':
      return 'Decision recorded'
    case 'reopened':
      return 'Request reopened'
    default:
      return 'Update'
  }
}

/** Student-visible timeline. Expects only events the server marked visible to the student. */
export default function CaseTimeline({ events }) {
  if (!events?.length) return <p className="text-sm text-slate-600">No activity yet.</p>

  return (
    <ol className="space-y-4 border-l-2 border-slate-200 pl-4" aria-label="Timeline">
      {events.map((event) => (
        <li key={event.id} className="relative">
          <span className="absolute -left-[1.4rem] top-1.5 h-2.5 w-2.5 rounded-full bg-blue-600" aria-hidden="true" />
          <p className="text-sm font-medium text-slate-900">{describe(event)}</p>
          <p className="text-xs text-slate-500">
            {ACTOR_LABELS[event.actor] ?? 'OfferShield'} · {new Date(event.createdAt).toLocaleString()}
          </p>
          {event.body && <p className="mt-1 whitespace-pre-wrap text-sm text-slate-700">{event.body}</p>}
        </li>
      ))}
    </ol>
  )
}
