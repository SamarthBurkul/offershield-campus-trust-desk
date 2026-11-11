import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { errorMessage } from '../api/errors.js'
import { listNotifications, markAllNotificationsRead, markNotificationRead } from '../api/notifications.js'
import EmptyState from '../components/EmptyState.jsx'
import Skeleton from '../components/Skeleton.jsx'
import { Button, Card, CheckboxField, ErrorAlert } from '../components/ui.jsx'
import usePageTitle from '../hooks/usePageTitle.js'
import { relativeTime } from '../utils/time.js'

const PAGE_SIZE = 20

export default function NotificationsPage() {
  usePageTitle('Notifications')
  const navigate = useNavigate()
  const [unread, setUnread] = useState(false)
  const [page, setPage] = useState(1)
  const [result, setResult] = useState(null)
  const [error, setError] = useState('')
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    let active = true
    listNotifications({ unread, page, limit: PAGE_SIZE })
      .then((data) => active && setResult(data))
      .catch((err) => active && setError(errorMessage(err, 'Could not load notifications.')))
    return () => {
      active = false
    }
  }, [unread, page, reloadKey])

  async function open(item) {
    if (!item.read) await markNotificationRead(item.id).catch(() => {})
    navigate(item.link)
  }

  const pages = result ? Math.max(1, Math.ceil(result.total / PAGE_SIZE)) : 1

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h1 className="text-2xl font-bold text-slate-900">Notifications</h1>
        <Button variant="secondary" onClick={() => markAllNotificationsRead().then(() => setReloadKey((key) => key + 1))}>
          Mark all read
        </Button>
      </div>
      <Card>
        <CheckboxField
          label="Unread only"
          checked={unread}
          onChange={(event) => {
            setUnread(event.target.checked)
            setPage(1)
          }}
        />
        <ErrorAlert message={error} />
        {!result && !error && <Skeleton rows={4} label="Loading notifications" />}
        {result?.notifications.length === 0 && <EmptyState title={unread ? 'No unread notifications' : 'No notifications yet'} />}
        {result?.notifications.length > 0 && (
          <ul className="divide-y divide-slate-100">
            {result.notifications.map((item) => (
              <li key={item.id}>
                <button type="button" onClick={() => open(item)} className={`block w-full px-2 py-3 text-left hover:bg-slate-50 ${item.read ? '' : 'bg-blue-50/60'}`}>
                  <span className="block font-medium text-slate-900">
                    {!item.read && <span className="mr-1 text-blue-700" aria-label="Unread">●</span>}
                    {item.title}
                  </span>
                  <span className="block text-sm text-slate-600">{item.body}</span>
                  <span className="block text-xs text-slate-400">{relativeTime(item.createdAt)}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
        {result && result.total > PAGE_SIZE && (
          <div className="flex items-center justify-between pt-2 text-sm">
            <Button variant="secondary" disabled={page <= 1} onClick={() => setPage(page - 1)}>
              Previous
            </Button>
            <span className="text-slate-600">
              Page {page} of {pages}
            </span>
            <Button variant="secondary" disabled={page >= pages} onClick={() => setPage(page + 1)}>
              Next
            </Button>
          </div>
        )}
      </Card>
    </div>
  )
}
