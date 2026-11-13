import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import App from '../App.jsx'
import { completeGoogleRegistration, getGooglePending, getMe } from '../api/auth.js'
import { getPolicies } from '../api/policies.js'

vi.mock('../api/auth.js', () => ({
  getMe: vi.fn(),
  login: vi.fn(),
  register: vi.fn(),
  logout: vi.fn(),
  changePassword: vi.fn(),
  getGooglePending: vi.fn(),
  completeGoogleRegistration: vi.fn(),
}))
vi.mock('../api/policies.js', () => ({ getPolicies: vi.fn() }))
vi.mock('../api/health.js', () => ({ getHealth: vi.fn(() => new Promise(() => {})) }))
vi.mock('../api/notifications.js', () => ({ getUnreadCount: vi.fn(() => Promise.resolve(0)), listNotifications: vi.fn() }))

const unauthorized = () => Object.assign(new Error('401'), { response: { status: 401, data: { error: { code: 'UNAUTHENTICATED', message: 'Authentication required' } } } })
const policies = (overrides = {}) => getPolicies.mockResolvedValue({ version: '2026-11-13', retentionMonths: 12, supportEmail: null, googleEnabled: true, emailEnabled: true, ...overrides })

function renderAt(path) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <App />
    </MemoryRouter>,
  )
}

afterEach(() => {
  vi.resetAllMocks()
})

describe('Continue with Google (G18)', () => {
  it('shows the Google link above the password form with an "or" divider when Google is enabled', async () => {
    getMe.mockRejectedValue(unauthorized())
    policies()
    renderAt('/login')
    const link = await screen.findByRole('link', { name: 'Continue with Google' })
    expect(link).toHaveAttribute('href', '/api/v1/auth/google/start?intent=login')
    expect(screen.getByRole('separator', { name: 'or' })).toBeInTheDocument()
    // The Google option comes before the email field.
    expect(link.compareDocumentPosition(screen.getByLabelText('Email')) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it('the registration page uses intent=register', async () => {
    getMe.mockRejectedValue(unauthorized())
    policies()
    renderAt('/register')
    expect(await screen.findByRole('link', { name: 'Sign up with Google' })).toHaveAttribute('href', '/api/v1/auth/google/start?intent=register')
  })

  it('hides the button when Google is not configured (Phase 8 behaviour)', async () => {
    getMe.mockRejectedValue(unauthorized())
    policies({ googleEnabled: false })
    renderAt('/login')
    expect(await screen.findByRole('heading', { name: 'Sign in' })).toBeInTheDocument()
    await waitFor(() => expect(getPolicies).toHaveBeenCalled())
    expect(screen.queryByRole('link', { name: 'Continue with Google' })).not.toBeInTheDocument()
    expect(screen.queryByRole('separator', { name: 'or' })).not.toBeInTheDocument()
  })

  it.each([
    ['google_failed', 'Google sign-in did not work. Please try again, or sign in with your email and password.'],
    ['account_unavailable', 'This account cannot sign in. Contact your placement cell if you think this is a mistake.'],
  ])('shows a fixed message for ?error=%s', async (code, message) => {
    getMe.mockRejectedValue(unauthorized())
    policies()
    renderAt(`/login?error=${code}`)
    expect(await screen.findByText(message)).toBeInTheDocument()
  })

  it('ignores unknown error codes (no reflected text)', async () => {
    getMe.mockRejectedValue(unauthorized())
    policies()
    renderAt('/login?error=%3Cb%3Ehello%3C%2Fb%3E')
    expect(await screen.findByRole('heading', { name: 'Sign in' })).toBeInTheDocument()
    expect(screen.queryByText(/hello/)).not.toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })
})

describe('GoogleCompletePage (G19)', () => {
  it('shows the Google account and submits the college details', async () => {
    getMe.mockRejectedValue(unauthorized())
    policies()
    getGooglePending.mockResolvedValue({ email: 'new.student@alpha.edu', name: 'New Student' })
    completeGoogleRegistration.mockResolvedValue({ user: { id: 'u9' } })
    const user = userEvent.setup()
    renderAt('/register/google')

    expect(await screen.findByText('new.student@alpha.edu')).toBeInTheDocument()
    expect(screen.getByText('New Student')).toBeInTheDocument()
    await user.type(screen.getByLabelText('College code'), 'alpha')
    await user.type(screen.getByLabelText('Join code'), 'JOIN1234')
    await user.selectOptions(screen.getByLabelText('Year'), '3')
    await user.type(screen.getByLabelText('Branch'), 'COMP')

    await user.click(screen.getByRole('button', { name: 'Create account' }))
    expect(await screen.findByText('Please read and accept the privacy notice and terms of use.')).toBeInTheDocument()
    expect(completeGoogleRegistration).not.toHaveBeenCalled()

    await user.click(screen.getByRole('checkbox'))
    getMe.mockResolvedValue({ user: { id: 'u9', name: 'New Student', email: 'new.student@alpha.edu', role: 'student', collegeId: 'c1', status: 'active', mustChangePassword: false, emailVerified: true, authMethods: ['google'] }, college: { id: 'c1', name: 'Alpha', branches: ['COMP'] } })
    await user.click(screen.getByRole('button', { name: 'Create account' }))
    await waitFor(() =>
      expect(completeGoogleRegistration).toHaveBeenCalledWith({ collegeCode: 'alpha', joinCode: 'JOIN1234', year: 3, branch: 'COMP', acceptPolicies: true }),
    )
  })

  it('explains an expired sign-up and shows the no-account notice', async () => {
    getMe.mockRejectedValue(unauthorized())
    policies()
    getGooglePending.mockRejectedValue(unauthorized())
    renderAt('/register/google?notice=no_account')
    expect(await screen.findByText('There is no OfferShield account for this Google address yet. Finish registering below to create one.')).toBeInTheDocument()
    expect(await screen.findByText('Your Google sign-up has expired or was not started. Start again with Continue with Google.')).toBeInTheDocument()
  })
})
