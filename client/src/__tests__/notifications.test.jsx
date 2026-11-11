import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, useLocation } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import App from '../App.jsx'
import { getMe } from '../api/auth.js'
import { getUnreadCount, listNotifications, markAllNotificationsRead, markNotificationRead } from '../api/notifications.js'

vi.mock('../api/auth.js', () => ({ getMe: vi.fn(), login: vi.fn(), register: vi.fn(), logout: vi.fn(), changePassword: vi.fn() }))
vi.mock('../api/notifications.js', () => ({
  getUnreadCount: vi.fn(),
  listNotifications: vi.fn(),
  markNotificationRead: vi.fn(() => Promise.resolve()),
  markAllNotificationsRead: vi.fn(() => Promise.resolve()),
}))
vi.mock('../api/advisories.js', () => ({ listAdvisories: vi.fn(() => Promise.resolve([])) }))
vi.mock('../api/cases.js', () => ({ getCase: vi.fn(() => new Promise(() => {})) }))
vi.mock('../api/health.js', () => ({ getHealth: vi.fn(() => new Promise(() => {})) }))

const student = { id: 's1', name: 'Asha Rao', email: 'asha@alpha.demo.edu', role: 'student', collegeId: 'c1', status: 'active', mustChangePassword: false }
const items = [
  { id: 'n1', type: 'case_decision', title: 'Outcome recorded for OS-DEMO-ALPHA-0003', body: 'Your placement cell recorded an outcome: Do not pay.', link: '/student/requests/case3', read: false, createdAt: new Date().toISOString() },
  { id: 'n2', type: 'advisory_published', title: 'Critical advisory: Fake Infosys offer', body: 'Your placement cell published a new advisory.', link: '/advisories/a1', read: false, createdAt: new Date().toISOString() },
]

function LocationProbe() {
  const location = useLocation()
  return <output data-testid="location">{location.pathname}</output>
}

afterEach(() => {
  vi.clearAllMocks()
})

describe('NotificationBell', () => {
  it('19. shows the unread count, opens an item (marking it read) and marks all read', async () => {
    getMe.mockResolvedValue({ user: student, college: { id: 'c1', name: 'Demo Alpha', code: 'demo-alpha', branches: ['COMP'] } })
    getUnreadCount.mockResolvedValue(2)
    listNotifications.mockResolvedValue({ notifications: items, page: 1, limit: 8, total: 2, unreadCount: 2 })
    const user = userEvent.setup()
    render(
      <MemoryRouter initialEntries={['/student']}>
        <App />
        <LocationProbe />
      </MemoryRouter>,
    )

    const bell = await screen.findByRole('button', { name: 'Notifications, 2 unread' })
    expect(screen.getByTestId('unread-badge')).toHaveTextContent('2')

    await user.click(bell)
    const menu = await screen.findByRole('menu', { name: 'Latest notifications' })
    expect(listNotifications).toHaveBeenCalledWith({ limit: 8 })
    await user.click(within(menu).getByRole('menuitem', { name: /Outcome recorded for OS-DEMO-ALPHA-0003/ }))
    expect(markNotificationRead).toHaveBeenCalledWith('n1')
    await waitFor(() => expect(screen.getByTestId('location')).toHaveTextContent('/student/requests/case3'))
    expect(screen.getByRole('button', { name: 'Notifications, 1 unread' })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Notifications, 1 unread' }))
    await user.click(await screen.findByRole('button', { name: 'Mark all read' }))
    expect(markAllNotificationsRead).toHaveBeenCalledTimes(1)
    await waitFor(() => expect(screen.queryByTestId('unread-badge')).not.toBeInTheDocument())
    expect(within(screen.getByRole('menu')).getByRole('link', { name: 'View all' })).toHaveAttribute('href', '/notifications')
  })
})
