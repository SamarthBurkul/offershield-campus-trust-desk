import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import App from '../App.jsx'
import { getMe } from '../api/auth.js'

vi.mock('../api/auth.js', () => ({ getMe: vi.fn(), login: vi.fn(), register: vi.fn(), logout: vi.fn(), changePassword: vi.fn() }))
vi.mock('../api/advisories.js', () => ({ listAdvisories: vi.fn(() => Promise.resolve([])) }))
vi.mock('../api/notifications.js', () => ({ getUnreadCount: vi.fn(() => Promise.resolve(0)), listNotifications: vi.fn() }))
vi.mock('../api/health.js', () => ({ getHealth: vi.fn(() => new Promise(() => {})) }))

const renderAt = (path) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <App />
    </MemoryRouter>,
  )

afterEach(() => {
  vi.clearAllMocks()
})

describe('LandingPage', () => {
  it('24a. signed-out visitors see what OfferShield is, with log in and register', async () => {
    getMe.mockRejectedValue(Object.assign(new Error('401'), { response: { status: 401 } }))
    renderAt('/')

    expect(screen.getByRole('heading', { level: 1, name: /trust & verification desk/i })).toBeInTheDocument()
    for (const title of ['Check before you pay', 'Ask your placement cell', 'Confirmed findings protect everyone']) {
      expect(screen.getByRole('heading', { name: title })).toBeInTheDocument()
    }
    expect(screen.getByRole('link', { name: 'Log in' })).toHaveAttribute('href', '/login')
    expect(screen.getByRole('link', { name: 'Register as a student' })).toHaveAttribute('href', '/register')
    expect(screen.getByText('OfferShield helps your placement cell review opportunities. It never certifies an offer as safe.')).toBeInTheDocument()
  })

  it('24b. a signed-in student visiting / is redirected to /student', async () => {
    getMe.mockResolvedValue({
      user: { id: 's1', name: 'Asha Rao', email: 'asha@alpha.demo.edu', role: 'student', collegeId: 'c1', status: 'active', mustChangePassword: false },
      college: { id: 'c1', name: 'Demo Alpha', code: 'demo-alpha', branches: [] },
    })
    renderAt('/')

    expect(await screen.findByRole('heading', { name: 'Welcome, Asha Rao' })).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Register as a student' })).not.toBeInTheDocument()
  })
})
