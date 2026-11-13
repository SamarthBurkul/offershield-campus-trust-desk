import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from '../App.jsx'
import { forgotPassword, getMe, resetPassword } from '../api/auth.js'
import { getPolicies } from '../api/policies.js'

vi.mock('../api/auth.js', () => ({
  getMe: vi.fn(),
  login: vi.fn(),
  register: vi.fn(),
  logout: vi.fn(),
  changePassword: vi.fn(),
  forgotPassword: vi.fn(),
  resetPassword: vi.fn(),
}))
vi.mock('../api/policies.js', () => ({ getPolicies: vi.fn() }))
vi.mock('../api/health.js', () => ({ getHealth: vi.fn(() => new Promise(() => {})) }))

const unauthorized = () => Object.assign(new Error('401'), { response: { status: 401, data: { error: { code: 'UNAUTHENTICATED', message: 'Authentication required' } } } })

function renderAt(path) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <App />
    </MemoryRouter>,
  )
}

beforeEach(() => {
  getMe.mockRejectedValue(unauthorized())
})
afterEach(() => {
  vi.resetAllMocks()
  vi.restoreAllMocks()
  window.history.replaceState(null, '', '/')
})

describe('ForgotPasswordPage (G21)', () => {
  it('the login link goes to /forgot-password, which always shows the same message after sending', async () => {
    getPolicies.mockResolvedValue({ emailEnabled: true, googleEnabled: false })
    forgotPassword.mockResolvedValue({ message: 'generic' })
    const user = userEvent.setup()
    renderAt('/login')
    await user.click(await screen.findByRole('link', { name: 'Forgot password?' }))
    expect(await screen.findByRole('heading', { name: 'Forgot password' })).toBeInTheDocument()

    await user.type(screen.getByLabelText('Email'), 'asha@alpha.edu')
    await user.click(screen.getByRole('button', { name: 'Send reset link' }))
    await waitFor(() => expect(forgotPassword).toHaveBeenCalledWith('asha@alpha.edu'))
    expect(
      await screen.findByText('If an account exists for that address, we have sent instructions to it. The link works once and expires in 30 minutes.'),
    ).toBeInTheDocument()
  })

  it('without email the page (and login) keep the placement-cell instructions', async () => {
    getPolicies.mockResolvedValue({ emailEnabled: false })
    renderAt('/forgot-password')
    expect(await screen.findByText('Ask your placement cell to reset it. They will give you a temporary password.')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Send reset link' })).not.toBeInTheDocument()
  })
})

describe('ResetPasswordPage (G21)', () => {
  it('reads the token from the link, removes it from the address bar and submits the new password', async () => {
    getPolicies.mockResolvedValue({ emailEnabled: true })
    window.history.replaceState(null, '', '/reset-password#token=abcDEF123_-tokenvalue-0123456789abcdefghij')
    const replace = vi.spyOn(window.history, 'replaceState')
    resetPassword.mockResolvedValue({ message: 'ok' })
    const user = userEvent.setup()
    renderAt('/reset-password')

    expect(await screen.findByRole('heading', { name: 'Choose a new password' })).toBeInTheDocument()
    expect(replace).toHaveBeenCalledWith(null, '', '/reset-password')
    expect(window.location.hash).toBe('')

    await user.type(screen.getByLabelText('New password'), 'BrandNewPass99')
    await user.type(screen.getByLabelText('Confirm new password'), 'Different99x')
    await user.click(screen.getByRole('button', { name: 'Set new password' }))
    expect(await screen.findByText('The new passwords do not match.')).toBeInTheDocument()
    expect(resetPassword).not.toHaveBeenCalled()

    await user.clear(screen.getByLabelText('Confirm new password'))
    await user.type(screen.getByLabelText('Confirm new password'), 'BrandNewPass99')
    await user.click(screen.getByRole('button', { name: 'Set new password' }))
    await waitFor(() => expect(resetPassword).toHaveBeenCalledWith('abcDEF123_-tokenvalue-0123456789abcdefghij', 'BrandNewPass99'))
    expect(await screen.findByText(/Your password has been changed/)).toBeInTheDocument()
  })

  it('shows the server message for an invalid or used link', async () => {
    getPolicies.mockResolvedValue({ emailEnabled: true })
    window.history.replaceState(null, '', '/reset-password?token=used-token-value-0123456789abcdef')
    resetPassword.mockRejectedValue(
      Object.assign(new Error('400'), { response: { status: 400, data: { error: { code: 'INVALID_TOKEN', message: 'This reset link is invalid or has expired. Request a new one.' } } } }),
    )
    const user = userEvent.setup()
    renderAt('/reset-password')
    await user.type(await screen.findByLabelText('New password'), 'BrandNewPass99')
    await user.type(screen.getByLabelText('Confirm new password'), 'BrandNewPass99')
    await user.click(screen.getByRole('button', { name: 'Set new password' }))
    expect(await screen.findByText('This reset link is invalid or has expired. Request a new one.')).toBeInTheDocument()
    expect(window.location.search).toBe('')
  })

  it('a link without a token explains what to do', async () => {
    getPolicies.mockResolvedValue({ emailEnabled: true })
    renderAt('/reset-password')
    expect(await screen.findByText('This reset link is incomplete. Open the link from the email again, or request a new one.')).toBeInTheDocument()
  })
})
