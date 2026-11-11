import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { getUnreadCount, listNotifications, markAllNotificationsRead, markNotificationRead } from '../api/notifications.js'
import { relativeTime } from '../utils/time.js'

const POLL_MS = 30_000

/**
 * In-app notifications. Polls the unread count every 30 s while the tab is visible and refetches
 * on focus (no sockets, ADR-037). The dropdown shows the latest 8.
 */
export default function NotificationBell() {
  const navigate = useNavigate()
  const [count, setCount] = useState(0)
  const [open, setOpen] = useState(false)
  const [items, setItems] = useState(null)
  const containerRef = useRef(null)

  const refreshCount = useCallback(() => {
    if (typeof document !== 'undefined' && document.hidden) return
    getUnreadCount()
      .then(setCount)
      .catch(() => {})
  }, [])

  useEffect(() => {
    refreshCount()
    const timer = setInterval(refreshCount, POLL_MS)
    const onVisible = () => !document.hidden && refreshCount()
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('focus', refreshCount)
    return () => {
      clearInterval(timer)
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('focus', refreshCount)
    }
  }, [refreshCount])

  useEffect(() => {
    if (!open) return undefined
    let active = true
    listNotifications({ limit: 8 })
      .then((data) => {
        if (!active) return
        setItems(data.notifications)
        setCount(data.unreadCount)
      })
      .catch(() => active && setItems([]))
    const onClick = (event) => containerRef.current && !containerRef.current.contains(event.target) && setOpen(false)
    const onKey = (event) => event.key === 'Escape' && setOpen(false)
    document.addEventListener('mousedown', onClick)
    document.addEventListener('keydown', onKey)
    return () => {
      active = false
      document.removeEventListener('mousedown', onClick)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  async function openItem(item) {
    setOpen(false)
    if (!item.read) {
      try {
        await markNotificationRead(item.id)
        setCount((value) => Math.max(0, value - 1))
      } catch {
        // Navigation still works if marking read fails.
      }
    }
    navigate(item.link)
  }

  async function markAll() {
    try {
      await markAllNotificationsRead()
      setCount(0)
      setItems((current) => current?.map((item) => ({ ...item, read: true })) ?? current)
    } catch {
      // Keep the current state; the next poll corrects the badge.
    }
  }

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        aria-label={count ? `Notifications, ${count} unread` : 'Notifications'}
        aria-expanded={open}
        aria-haspopup="true"
        onClick={() => setOpen((value) => !value)}
        className="relative rounded-md border border-slate-300 px-2.5 py-1.5 text-slate-700 hover:bg-slate-50"
      >
        <span aria-hidden="true">🔔</span>
        {count > 0 && (
          <span data-testid="unread-badge" className="absolute -right-1.5 -top-1.5 min-w-5 rounded-full bg-red-600 px-1 text-center text-xs font-bold text-white">
            {count > 99 ? '99+' : count}
          </span>
        )}
      </button>
      {open && (
        <div role="menu" aria-label="Latest notifications" className="absolute right-0 z-40 mt-2 w-80 max-w-[90vw] rounded-lg border border-slate-200 bg-white shadow-lg">
          <div className="flex items-center justify-between border-b border-slate-100 px-3 py-2">
            <span className="text-sm font-semibold text-slate-900">Notifications</span>
            <button type="button" onClick={markAll} className="text-xs font-medium text-blue-700 hover:underline">
              Mark all read
            </button>
          </div>
          {items === null && <p className="px-3 py-4 text-sm text-slate-500">Loading…</p>}
          {items?.length === 0 && <p className="px-3 py-4 text-sm text-slate-500">You have no notifications.</p>}
          {items?.length > 0 && (
            <ul className="max-h-96 divide-y divide-slate-100 overflow-y-auto">
              {items.map((item) => (
                <li key={item.id}>
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => openItem(item)}
                    className={`block w-full px-3 py-2 text-left hover:bg-slate-50 ${item.read ? '' : 'bg-blue-50/60'}`}
                  >
                    <span className="block text-sm font-medium text-slate-900">{item.title}</span>
                    <span className="block text-xs text-slate-600">{item.body}</span>
                    <span className="block text-xs text-slate-400">{relativeTime(item.createdAt)}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          <Link to="/notifications" onClick={() => setOpen(false)} className="block border-t border-slate-100 px-3 py-2 text-center text-sm font-medium text-blue-700 hover:underline">
            View all
          </Link>
        </div>
      )}
    </div>
  )
}
