import { ROLE_LABELS } from '../auth/roles.js'
import { Card } from './ui.jsx'

/** Staff-only internal notes (append-only on the server). */
export default function NotesPanel({ notes }) {
  return (
    <Card title="Internal notes">
      <p className="text-xs text-slate-500">
        <span aria-hidden="true">🔒 </span>Staff only. Notes cannot be edited or deleted.
      </p>
      {notes.length === 0 ? (
        <p className="text-sm text-slate-600">No internal notes yet.</p>
      ) : (
        <ul className="space-y-3" aria-label="Internal notes">
          {notes.map((note) => (
            <li key={note.id} className="rounded-md border border-slate-200 bg-slate-50 p-3">
              <p className="whitespace-pre-wrap text-sm text-slate-800">{note.body}</p>
              <p className="mt-1 text-xs text-slate-500">
                {note.author?.name ?? 'Staff'}
                {note.author?.role ? ` (${ROLE_LABELS[note.author.role]})` : ''} · {new Date(note.createdAt).toLocaleString()}
              </p>
            </li>
          ))}
        </ul>
      )}
    </Card>
  )
}
