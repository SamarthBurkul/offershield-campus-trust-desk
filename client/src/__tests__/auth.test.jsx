import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import App from '../App.jsx'
import { getMe, login } from '../api/auth.js'

vi.mock('../api/auth.js', () => ({
  getMe: vi.fn(),
  login: vi.fn(),
  register: vi.fn(),
  logout: vi.fn(),
  changePassword: vi.fn(),
}))
vi.mock('../api/health.js', () => ({ getHealth: vi.fn(() => new Promise(() => {})) }))
vi.mock('../api/staff.js', () => ({ listStaffMembers: vi.fn(() => new Promise(() => {})) }))
vi.mock('../api/admin.js', () => ({ listColleges: vi.fn(() => new Promise(() => {})) }))

const unauthorized = () => Object.assign(new Error('Request failed with status code 401'), {
  response: { status: 401, data: { error: { code: 'UNAUTHENTICATED', message: 'Authentication required' } } },
})

function user(overrides = {}) {
  return {
    id: 'u1',
    name: 'Asha Rao',
    email: 'asha@alpha.demo.edu',
    role: 'student',
    collegeId: 'c1',
    status: 'active',
    mustChangePassword: false,
    ...overrides,
  }
}

const college = { id: 'c1', name: 'Demo Alpha Institute', code: 'demo-alpha', branches: ['COMP'] }

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

describe('ProtectedRoute', () => {
  it('26. redirects an unauthenticated user to /login', async () => {
    getMe.mockRejectedValue(unauthorized())

    renderAt('/student')

    expect(await screen.findByRole('heading', { name: 'Sign in' })).toBeInTheDocument()
    expect(screen.queryByText(/welcome/i)).not.toBeInTheDocument()
  })

  it('27. renders the Forbidden page for the wrong role', async () => {
    getMe.mockResolvedValue({ user: user({ role: 'student' }), college })

    renderAt('/admin')

    expect(await screen.findByRole('heading', { name: /access denied/i })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Colleges' })).not.toBeInTheDocument()
  })

  it('28. redirects a mustChangePassword user to /change-password', async () => {
    getMe.mockResolvedValue({ user: user({ role: 'tpo_head', mustChangePassword: true }), college })

    renderAt('/staff')

    expect(await screen.findByRole('heading', { name: /change password/i })).toBeInTheDocument()
    expect(screen.getByText(/temporary password/i)).toBeInTheDocument()
  })
})

describe('LoginPage', () => {
  it('29. shows the server error message on 401', async () => {
    getMe.mockRejectedValue(unauthorized())
    login.mockRejectedValue(
      Object.assign(new Error('Request failed with status code 401'), {
        response: { status: 401, data: { error: { code: 'INVALID_CREDENTIALS', message: 'Invalid email or password' } } },
      }),
    )
    const userEvents = userEvent.setup()
    renderAt('/login')

    await userEvents.type(await screen.findByLabelText('Email'), 'asha@alpha.demo.edu')
    await userEvents.type(screen.getByLabelText('Password'), 'WrongPass123')
    await userEvents.click(screen.getByRole('button', { name: 'Sign in' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Invalid email or password')
    expect(login).toHaveBeenCalledWith({ email: 'asha@alpha.demo.edu', password: 'WrongPass123' })
  })

  it.each([
    ['student', '/student', /welcome, asha rao/i],
    ['tpo_head', '/staff', /welcome, asha rao/i],
    ['super_admin', '/admin', /^colleges$/i],
  ])('30. a successful %s login redirects to %s', async (role, _path, heading) => {
    const signedIn = user({ role, collegeId: role === 'super_admin' ? null : 'c1' })
    getMe.mockRejectedValueOnce(unauthorized()).mockResolvedValue({ user: signedIn, college: role === 'super_admin' ? null : college })
    login.mockResolvedValue({ user: signedIn })
    const userEvents = userEvent.setup()
    renderAt('/login')

    await userEvents.type(await screen.findByLabelText('Email'), 'asha@alpha.demo.edu')
    await userEvents.type(screen.getByLabelText('Password'), 'RightPass123')
    await userEvents.click(screen.getByRole('button', { name: 'Sign in' }))

    expect(await screen.findByRole('heading', { level: 1, name: heading })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Sign in' })).not.toBeInTheDocument()
  })
})

describe('Layout', () => {
  it("shows the signed-in user's name, role and a logout button", async () => {
    getMe.mockResolvedValue({ user: user({ role: 'placement_officer' }), college })

    renderAt('/staff')

    const header = within(screen.getByRole('banner'))
    expect(await header.findByRole('button', { name: /log out/i })).toBeInTheDocument()
    expect(header.getByText('Asha Rao')).toBeInTheDocument()
    expect(header.getByText(/placement officer/i)).toBeInTheDocument()
  })
})
