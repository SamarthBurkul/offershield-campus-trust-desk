import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import App from '../App.jsx'
import { getMe, register } from '../api/auth.js'
import apiClient from '../api/client.js'
import { getPolicies } from '../api/policies.js'
import { SLOW_REQUEST_MS } from '../api/slowRequests.js'
import { AuthContext } from '../auth/useAuth.js'
import DemoBanner from '../components/DemoBanner.jsx'
import WakingServerBanner from '../components/WakingServerBanner.jsx'

vi.mock('../api/auth.js', () => ({ getMe: vi.fn(), login: vi.fn(), register: vi.fn(), logout: vi.fn(), changePassword: vi.fn() }))
vi.mock('../api/policies.js', () => ({ getPolicies: vi.fn() }))
vi.mock('../api/notifications.js', () => ({ getUnreadCount: vi.fn(() => Promise.resolve(0)), listNotifications: vi.fn() }))
vi.mock('../api/health.js', () => ({ getHealth: vi.fn(() => new Promise(() => {})) }))

const signedOut = () => getMe.mockRejectedValue(new Error('401'))

function renderAt(path) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <App />
    </MemoryRouter>,
  )
}

afterEach(() => {
  vi.clearAllMocks()
  vi.useRealTimers()
})

describe('privacy notice and terms', () => {
  it('18a. the privacy page renders the real retention period, support contact and version', async () => {
    signedOut()
    getPolicies.mockResolvedValue({ version: '2026-11-12', retentionMonths: 18, supportEmail: 'privacy@desk.example.edu' })
    renderAt('/privacy')

    expect(await screen.findByRole('heading', { name: 'Privacy notice' })).toBeInTheDocument()
    expect(await screen.findByText(/deleted 18 months after a request is closed/)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'privacy@desk.example.edu' })).toHaveAttribute('href', 'mailto:privacy@desk.example.edu')
    expect(screen.getByText(/never asks for your Aadhaar number, PAN/)).toBeInTheDocument()
    expect(screen.getByText(/cannot open requests, messages\s+or evidence/)).toBeInTheDocument()
    expect(screen.getAllByText(/never certifies an offer as\s+safe/).length).toBeGreaterThan(0)
    expect(screen.getByText('Version 2026-11-12')).toBeInTheDocument()
  })

  it('18b. the terms page renders, and the footer links to both pages', async () => {
    signedOut()
    getPolicies.mockRejectedValue(new Error('offline'))
    renderAt('/terms')

    expect(await screen.findByRole('heading', { name: 'Terms of use' })).toBeInTheDocument()
    expect(screen.getByText(/not a guarantee, legal advice/)).toBeInTheDocument()
    const footer = screen.getByRole('navigation', { name: 'Legal' })
    expect(within(footer).getByRole('link', { name: 'Privacy' })).toHaveAttribute('href', '/privacy')
    expect(within(footer).getByRole('link', { name: 'Terms' })).toHaveAttribute('href', '/terms')
  })
})

describe('registration consent', () => {
  it('17. requires the policies checkbox and links to /privacy and /terms', async () => {
    signedOut()
    register.mockResolvedValue({ user: {} })
    const user = userEvent.setup()
    renderAt('/register')

    await screen.findByRole('heading', { name: 'Student registration' })
    await user.type(screen.getByLabelText('Full name'), 'Asha Rao')
    await user.type(screen.getByLabelText('Email'), 'asha@gmail.com')
    await user.type(screen.getByLabelText('Password'), 'StudentPass123')
    await user.type(screen.getByLabelText('College code'), 'demo-campus')
    await user.type(screen.getByLabelText('Join code'), 'ABCD-1234')
    await user.type(screen.getByLabelText('Branch'), 'COMP')
    await user.click(screen.getByRole('button', { name: 'Create account' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Please read and accept the privacy notice and terms of use.')
    expect(register).not.toHaveBeenCalled()

    const consent = screen.getByRole('checkbox', { name: /I have read and accept/ })
    const label = consent.closest('div')
    expect(within(label).getByRole('link', { name: 'privacy notice' })).toHaveAttribute('href', '/privacy')
    expect(within(label).getByRole('link', { name: 'terms of use' })).toHaveAttribute('href', '/terms')

    await user.click(consent)
    await user.click(screen.getByRole('button', { name: 'Create account' }))
    await waitFor(() => expect(register).toHaveBeenCalledWith(expect.objectContaining({ acceptPolicies: true, email: 'asha@gmail.com' })))
  })

  it('the login page explains staff-assisted password resets', async () => {
    signedOut()
    const user = userEvent.setup()
    renderAt('/login')

    await user.click(await screen.findByRole('button', { name: 'Forgot password?' }))
    expect(screen.getByText('Ask your placement cell to reset it. They will give you a temporary password.')).toBeInTheDocument()
  })
})

describe('pending approval', () => {
  it('15. a pending student is redirected to the waiting page and sees no navigation', async () => {
    getMe.mockResolvedValue({
      user: { id: 's1', name: 'Kiran', email: 'kiran@gmail.com', role: 'student', collegeId: 'c1', status: 'pending_approval', mustChangePassword: false },
      college: { id: 'c1', name: 'Manual College', code: 'manual', branches: ['COMP'], studentVerification: 'manual_approval', isDemo: false },
    })
    renderAt('/student/requests')

    expect(await screen.findByRole('heading', { name: 'Waiting for your placement cell to approve your account' })).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'My requests' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /notifications/i })).not.toBeInTheDocument()
  })
})

describe('banners', () => {
  const withCollege = (college) => (
    <AuthContext.Provider value={{ user: null, college, loading: false }}>
      <DemoBanner />
    </AuthContext.Provider>
  )

  it('21. the demo banner shows only when college.isDemo is true', () => {
    const { rerender } = render(withCollege({ id: 'c1', isDemo: true }))
    expect(screen.getByText('Demo environment — sample data')).toBeInTheDocument()

    rerender(withCollege({ id: 'c1', isDemo: false }))
    expect(screen.queryByText('Demo environment — sample data')).not.toBeInTheDocument()
    rerender(withCollege(null))
    expect(screen.queryByText('Demo environment — sample data')).not.toBeInTheDocument()
  })

  it('20. the waking-server banner appears after 5 s of a pending request and hides when it resolves', async () => {
    vi.useFakeTimers()
    render(<WakingServerBanner />)
    let finish
    const pending = apiClient.get('/health', {
      adapter: (config) => new Promise((resolve) => {
        finish = () => resolve({ data: { status: 'ok' }, status: 200, statusText: 'OK', headers: {}, config })
      }),
    })
    const text = 'Starting the server — this can take up to a minute on the free plan.'

    await act(async () => {
      vi.advanceTimersByTime(SLOW_REQUEST_MS - 1)
    })
    expect(screen.queryByText(text)).not.toBeInTheDocument()

    await act(async () => {
      vi.advanceTimersByTime(1)
    })
    expect(screen.getByRole('status')).toHaveTextContent(text)

    await act(async () => {
      finish()
      await pending
    })
    expect(screen.queryByText(text)).not.toBeInTheDocument()
  })

  it('a request that finishes quickly never shows the banner', async () => {
    vi.useFakeTimers()
    render(<WakingServerBanner />)
    await act(async () => {
      await apiClient.get('/health', { adapter: async (config) => ({ data: {}, status: 200, statusText: 'OK', headers: {}, config }) })
      vi.advanceTimersByTime(SLOW_REQUEST_MS * 2)
    })
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })
})
