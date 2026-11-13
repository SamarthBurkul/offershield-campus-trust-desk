import clsx from 'clsx'
import {
  ArrowRightLeft,
  CircleDot,
  FilePlus2,
  Gavel,
  HelpCircle,
  Link2,
  Lock,
  MessageSquare,
  Paperclip,
  RotateCcw,
  Send,
  Sparkles,
  Trash2,
  UserCheck,
} from 'lucide-react'
import { ROLE_LABELS } from '../auth/roles.js'
import { DECISION_TYPE_LABELS, STAFF_STATUS_LABELS } from '../constants/caseStatus.js'
import { formatDateTime, relativeTime } from '../utils/format.js'
import { Avatar, Badge } from './ui/index.js'

const STUDENT_ACTOR_LABELS = { student: 'You', placement_cell: 'Placement cell', system: 'OfferShield' }

const EVENT_ICONS = {
  created: FilePlus2,
  student_message: MessageSquare,
  evidence_added: Paperclip,
  status_changed: ArrowRightLeft,
  info_requested: HelpCircle,
  staff_message: Send,
  assigned: UserCheck,
  recommendation_made: Sparkles,
  decision_recorded: Gavel,
  reopened: RotateCcw,
  linked: Link2,
  evidence_purged: Trash2,
}

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
    case 'evidence_purged':
      return `Evidence deleted under the retention policy (${event.metadata?.count ?? 0} file${event.metadata?.count === 1 ? '' : 's'})`
    case 'linked':
      return `${event.metadata?.action === 'unlink' ? 'Unlinked from' : 'Linked to'} ${event.metadata?.otherCaseNumber ?? 'another case'}`
    default:
      return 'Update'
  }
}

function actorName(event) {
  if (typeof event.actor === 'string') return STUDENT_ACTOR_LABELS[event.actor] ?? 'OfferShield'
  if (!event.actor) return 'OfferShield'
  return event.actor.name ?? ROLE_LABELS[event.actor.role] ?? 'OfferShield'
}

function actorRole(event) {
  if (!event.actor || typeof event.actor === 'string') return null
  return event.actor.name ? (ROLE_LABELS[event.actor.role] ?? event.actor.role) : null
}

/**
 * Case timeline. Students get only visible events from the server; staff pass showVisibility to
 * see which events the student can read and which are internal.
 */
export default function CaseTimeline({ events, showVisibility = false }) {
  if (!events?.length) return <p className="text-sm text-slate-600">No activity yet.</p>

  return (
    <ol className="relative space-y-5" aria-label="Timeline">
      <span className="absolute bottom-2 left-[15px] top-2 w-px bg-slate-200" aria-hidden="true" />
      {events.map((event) => {
        const Icon = EVENT_ICONS[event.type] ?? CircleDot
        const internal = showVisibility && !event.visibleToStudent
        const role = actorRole(event)
        return (
          <li key={event.id} className="relative flex gap-3">
            <span
              className={clsx(
                'relative z-10 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full ring-4 ring-white',
                internal ? 'bg-slate-200 text-slate-600' : event.type === 'decision_recorded' ? 'bg-brand-900 text-white' : 'bg-accent-50 text-accent-700',
              )}
              aria-hidden="true"
            >
              <Icon className="h-4 w-4" />
            </span>
            <div className={clsx('min-w-0 flex-1 rounded-xl px-3 py-2', internal && 'bg-slate-50 ring-1 ring-inset ring-slate-200')}>
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <p className="text-sm font-semibold text-slate-900">{describe(event, showVisibility)}</p>
                {showVisibility &&
                  (event.visibleToStudent ? (
                    <Badge tone="info" size="sm">
                      Visible to student
                    </Badge>
                  ) : (
                    <Badge tone="neutral" size="sm" icon={Lock}>
                      Internal
                    </Badge>
                  ))}
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-slate-500">
                <Avatar name={actorName(event)} size="xs" />
                <span className="font-medium text-slate-700">{actorName(event)}</span>
                {role && <span>· {role}</span>}
                <span aria-hidden="true">·</span>
                <time dateTime={event.createdAt} title={formatDateTime(event.createdAt)}>
                  {relativeTime(event.createdAt)}
                </time>
              </div>
              {event.body && <p className="mt-2 whitespace-pre-wrap rounded-xl rounded-tl-sm bg-slate-100/80 px-3 py-2 text-sm leading-6 text-slate-800">{event.body}</p>}
              {showVisibility && event.type === 'reopened' && event.metadata?.reason && (
                <p className="mt-2 text-sm text-slate-600">
                  <span className="font-medium">Reason (internal):</span> {event.metadata.reason}
                </p>
              )}
            </div>
          </li>
        )
      })}
    </ol>
  )
}
