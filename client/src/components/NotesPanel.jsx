import { Lock, NotebookPen } from 'lucide-react'
import { ROLE_LABELS } from '../auth/roles.js'
import { formatDateTime, relativeTime } from '../utils/format.js'
import { Avatar, Card } from './ui/index.js'

/** Staff-only internal notes (append-only on the server). */
export default function NotesPanel({ notes }) {
  return (
    <Card title="Internal notes" icon={NotebookPen}>
      <p className="-mt-1 flex items-center gap-1.5 text-xs text-slate-500">
        <Lock className="h-3.5 w-3.5" aria-hidden="true" />
        Staff only. Notes cannot be edited or deleted.
      </p>
      {notes.length === 0 ? (
        <p className="text-sm text-slate-600">No internal notes yet.</p>
      ) : (
        <ul className="space-y-3" aria-label="Internal notes">
          {notes.map((note) => (
            <li key={note.id} className="rounded-xl bg-slate-50 p-3 ring-1 ring-inset ring-slate-200">
              <div className="flex flex-wrap items-center gap-1.5 text-xs text-slate-500">
                <Avatar name={note.author?.name ?? 'Staff'} size="xs" />
                <span className="font-medium text-slate-700">{note.author?.name ?? 'Staff'}</span>
                {note.author?.role && <span>· {ROLE_LABELS[note.author.role]}</span>}
                <span aria-hidden="true">·</span>
                <time dateTime={note.createdAt} title={formatDateTime(note.createdAt)}>
                  {relativeTime(note.createdAt)}
                </time>
              </div>
              <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-800">{note.body}</p>
            </li>
          ))}
        </ul>
      )}
    </Card>
  )
}
