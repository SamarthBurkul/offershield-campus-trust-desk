import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import App from '../App.jsx'
import { getMe, resendVerification, verifyEmail } from '../api/auth.js'

vi.mock('../api/auth.js', () => ({
  getMe: vi.fn(),
  login: vi.fn(),
  register: vi.fn(),
  logout: vi.fn(),
  changePassword: vi.fn(),
  verifyEmail: vi.fn(),
  resendVerification: vi.fn(),
}))
vi.mock('../api/policies.js', () => ({ getPolicies: vi.fn(() => Promise.resolve({})) }))
vi.mock('../api/health.js', () => ({ getHealth: vi.fn(() => new Promise(() => {})) }))
vi.mock('../api/notifications.js', () => ({ getUnreadCount: vi.fn(() => Promise.resolve(0)), listNotifications: vi.fn() }))
vi.mock('../api/cases.js', () => ({ listMyCases: vi.fn(() => new Promise(() => {})), getCase: vi.fn() }))
vi.mock('../api/advisories.js', () => ({ listAdvisories: vi.fn(() => new Promise(() => {})), listStudentAdvisories: vi.fn(() => new Promise(() => {})) }))

const college = { id: 'c1', name: 'Alpha', code: 'alpha', branches: ['COMP'] }
const student = (overrides = {}) => ({
  id: 's1',
  name: 'Asha Rao',
  email: 'asha@alpha.edu',
  role: 'student',
  collegeId: 'c1',
  status: 'active',
  mustChangePassword: false,
  emailVerified: false,
  authMethods: ['password'],
  ...overrides,
})

function renderAt(path) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <App />
    </MemoryRouter>,
  )
}

afterEach(() => {
  vi.resetAllMocks()
  vi.useRealTimers()
})

const boxes = () => screen.getAllByRole('textbox', { name: /^Digit \d$/ })

describe('VerifyEmailPage (G20)', () => {
  it('sends an unverified student to /verify-email first; pasting fills all six boxes and verifies', async () => {
    getMe.mockResolvedValue({ user: student(), college, emailVerificationRequired: true })
    verifyEmail.mockResolvedValue(student({ emailVerified: true }))
    const user = userEvent.setup()
    renderAt('/student')

    expect(await screen.findByRole('heading', { name: 'Verify your email' })).toBeInTheDocument()
    expect(screen.getByText('asha@alpha.edu')).toBeInTheDocument()
    expect(boxes()).toHaveLength(6)

    fireEvent.paste(boxes()[0], { clipboardData: { getData: () => ' 12-34 56 ' } })
    expect(boxes().map((box) => box.value).join('')).toBe('123456')

    getMe.mockResolvedValue({ user: student({ emailVerified: true }), college, emailVerificationRequired: true })
    await user.click(screen.getByRole('button', { name: 'Verify email' }))
    await waitFor(() => expect(verifyEmail).toHaveBeenCalledWith('123456'))
    await waitFor(() => expect(screen.queryByRole('heading', { name: 'Verify your email' })).not.toBeInTheDocument())
  })

  it('typing moves between boxes; a wrong code shows the error and clears the boxes', async () => {
    getMe.mockResolvedValue({ user: student(), college, emailVerificationRequired: true })
    verifyEmail.mockRejectedValue(
      Object.assign(new Error('400'), { response: { status: 400, data: { error: { code: 'INVALID_CODE', message: 'That code is not valid or has expired. Request a new code.' } } } }),
    )
    const user = userEvent.setup()
    renderAt('/verify-email')
    await screen.findByRole('heading', { name: 'Verify your email' })
    await user.click(boxes()[0])
    await user.keyboard('654321')
    expect(boxes().map((box) => box.value).join('')).toBe('654321')
    await user.click(screen.getByRole('button', { name: 'Verify email' }))
    expect(await screen.findByText('That code is not valid or has expired. Request a new code.')).toBeInTheDocument()
    expect(boxes().map((box) => box.value).join('')).toBe('')
  })

  it('resend waits for the 60 s countdown, then requests a new code', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    getMe.mockResolvedValue({ user: student(), college, emailVerificationRequired: true })
    resendVerification.mockResolvedValue({ sent: true, retryAfterSeconds: 60 })
    renderAt('/verify-email')
    const resend = await screen.findByRole('button', { name: /Resend code in \d+s/ })
    expect(resend).toBeDisabled()

    for (let i = 0; i < 61; i += 1) {
      await act(async () => {
        vi.advanceTimersByTime(1000)
      })
    }
    const ready = screen.getByRole('button', { name: 'Resend code' })
    expect(ready).toBeEnabled()
    fireEvent.click(ready)
    await waitFor(() => expect(resendVerification).toHaveBeenCalledTimes(1))
    expect(await screen.findByText('We sent a new code. Codes expire after 10 minutes.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Resend code in \d+s/ })).toBeDisabled()
  })

  it('does not gate a verified user, or anyone when verification is not required', async () => {
    getMe.mockResolvedValue({ user: student(), college, emailVerificationRequired: false })
    renderAt('/verify-email')
    await waitFor(() => expect(screen.queryByRole('heading', { name: 'Verify your email' })).not.toBeInTheDocument())
  })

  it.each(['tpo_head', 'placement_officer', 'super_admin'])('an unverified %s is never sent to /verify-email (Phase 9.1)', async (role) => {
    getMe.mockResolvedValue({ user: student({ role, collegeId: role === 'super_admin' ? null : 'c1', year: null, branch: null }), college: role === 'super_admin' ? null : college, emailVerificationRequired: true })
    renderAt('/verify-email')
    // The page sends anyone who does not need verification to their home instead.
    await waitFor(() => expect(screen.queryByRole('heading', { name: 'Verify your email' })).not.toBeInTheDocument())
    expect(screen.queryByText('We sent a 6-digit code to')).not.toBeInTheDocument()
  })

  it('email verification comes before the pending-approval page', async () => {
    getMe.mockResolvedValue({ user: student({ status: 'pending_approval' }), college, emailVerificationRequired: true })
    renderAt('/pending-approval')
    expect(await screen.findByRole('heading', { name: 'Verify your email' })).toBeInTheDocument()
  })
})
