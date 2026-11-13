import clsx from 'clsx'
import { Bell, CheckCheck } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { getUnreadCount, listNotifications, markAllNotificationsRead, markNotificationRead } from '../api/notifications.js'
import { formatDateTime, relativeTime } from '../utils/format.js'

const POLL_MS = 30_000

/**
 * In-app notifications. Polls the unread count every 30 s while the tab is visible and refetches
 * on focus (no sockets, ADR-037). The dropdown shows the latest 8. `tone="dark"` for navy bars.
 */
export default function NotificationBell({ tone = 'light' }) {
  const navigate = useNavigate()
  const [count, setCount] = useState(0)
  const [open, setOpen] = useState(false)
  const [items, setItems] = useState(null)
  const containerRef = useRef(null)
  const buttonRef = useRef(null)

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
    const onKey = (event) => {
      if (event.key !== 'Escape') return
      setOpen(false)
      buttonRef.current?.focus()
    }
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
        ref={buttonRef}
        type="button"
        aria-label={count ? `Notifications, ${count} unread` : 'Notifications'}
        aria-expanded={open}
        aria-haspopup="true"
        onClick={() => setOpen((value) => !value)}
        className={clsx(
          'relative inline-flex h-10 w-10 items-center justify-center rounded-xl transition-colors duration-150',
          tone === 'dark' ? 'text-brand-100 hover:bg-white/10 hover:text-white' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900',
        )}
      >
        <Bell className="h-5 w-5" aria-hidden="true" />
        {count > 0 && (
          <span
            data-testid="unread-badge"
            className="absolute right-1 top-1 min-w-[18px] rounded-full bg-rose-600 px-1 text-center text-[10px] font-bold leading-[18px] text-white ring-2 ring-white"
          >
            {count > 99 ? '99+' : count}
          </span>
        )}
      </button>
      {open && (
        <div
          role="menu"
          aria-label="Latest notifications"
          className="absolute right-0 z-40 mt-2 w-[22rem] max-w-[calc(100vw-2rem)] animate-pop-in overflow-hidden rounded-2xl bg-white text-slate-800 shadow-raised ring-1 ring-slate-900/10"
        >
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
            <span className="text-sm font-semibold text-slate-900">Notifications</span>
            <button type="button" onClick={markAll} className="inline-flex items-center gap-1 rounded-md text-xs font-medium text-accent-700 hover:text-accent-800">
              <CheckCheck className="h-3.5 w-3.5" aria-hidden="true" />
              Mark all read
            </button>
          </div>
          {items === null && <p className="px-4 py-6 text-sm text-slate-500">Loading…</p>}
          {items?.length === 0 && <p className="px-4 py-6 text-center text-sm text-slate-500">You have no notifications.</p>}
          {items?.length > 0 && (
            <ul className="max-h-96 divide-y divide-slate-100 overflow-y-auto">
              {items.map((item) => (
                <li key={item.id}>
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => openItem(item)}
                    className={clsx('flex w-full gap-3 px-4 py-3 text-left transition-colors hover:bg-slate-50', !item.read && 'bg-accent-50/50')}
                  >
                    <span className={clsx('mt-1.5 h-2 w-2 shrink-0 rounded-full', item.read ? 'bg-transparent' : 'bg-accent-600')} aria-hidden="true" />
                    <span className="min-w-0">
                      <span className="block text-sm font-medium text-slate-900">{item.title}</span>
                      <span className="mt-0.5 block text-xs leading-5 text-slate-600">{item.body}</span>
                      <span className="mt-1 block text-[11px] text-slate-400" title={formatDateTime(item.createdAt)}>
                        {relativeTime(item.createdAt)}
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          <Link
            to="/notifications"
            onClick={() => setOpen(false)}
            className="block border-t border-slate-100 px-4 py-2.5 text-center text-sm font-medium text-accent-700 transition hover:bg-slate-50"
          >
            View all
          </Link>
        </div>
      )}
    </div>
  )
}
