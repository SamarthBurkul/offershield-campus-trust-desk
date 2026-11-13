import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { errorMessage } from '../api/errors.js'
import { listNotifications, markAllNotificationsRead, markNotificationRead } from '../api/notifications.js'
import clsx from 'clsx'
import { BellOff, CheckCheck, ChevronRight } from 'lucide-react'
import { Button, Card, CheckboxField, EmptyState, ErrorAlert, PageHeader, Pagination, Skeleton } from '../components/ui/index.js'
import usePageTitle from '../hooks/usePageTitle.js'
import { formatDateTime, relativeTime } from '../utils/format.js'

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
      <PageHeader
        title="Notifications"
        description="Updates on your requests, cases and advisories. Notifications are deleted after 180 days."
        actions={
          <Button variant="secondary" icon={CheckCheck} onClick={() => markAllNotificationsRead().then(() => setReloadKey((key) => key + 1))}>
            Mark all read
          </Button>
        }
      />
      <Card padded={false}>
        <div className="border-b border-slate-100 px-5 py-3">
          <CheckboxField
            label="Unread only"
            checked={unread}
            onChange={(event) => {
              setUnread(event.target.checked)
              setPage(1)
            }}
          />
        </div>
        <div className="p-5 empty:hidden">
          <ErrorAlert message={error} />
          {!result && !error && <Skeleton rows={4} label="Loading notifications" />}
          {result?.notifications.length === 0 && <EmptyState icon={BellOff} title={unread ? 'No unread notifications' : 'No notifications yet'} />}
        </div>
        {result?.notifications.length > 0 && (
          <ul className="divide-y divide-slate-100">
            {result.notifications.map((item) => (
              <li key={item.id}>
                <button type="button" onClick={() => open(item)} className={clsx('flex w-full gap-3 px-5 py-4 text-left transition hover:bg-slate-50', !item.read && 'bg-accent-50/40')}>
                  <span className={clsx('mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full', item.read ? 'bg-slate-200' : 'bg-accent-600')} aria-label={item.read ? undefined : 'Unread'} />
                  <span className="min-w-0 flex-1">
                    <span className="block font-medium text-slate-900">{item.title}</span>
                    <span className="mt-0.5 block text-sm text-slate-600">{item.body}</span>
                    <span className="mt-1 block text-xs text-slate-400" title={formatDateTime(item.createdAt)}>
                      {relativeTime(item.createdAt)}
                    </span>
                  </span>
                  <ChevronRight className="mt-1 h-4 w-4 shrink-0 text-slate-300" aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>
        )}
        {result && <Pagination page={page} totalPages={pages} onPage={setPage} />}
      </Card>
    </div>
  )
}
