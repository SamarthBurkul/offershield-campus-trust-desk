import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import App from '../App.jsx'
import { getAccount, updateAccount } from '../api/account.js'
import { getMe } from '../api/auth.js'
import { listStudents, promoteYear } from '../api/students.js'

vi.mock('../api/auth.js', () => ({ getMe: vi.fn(), login: vi.fn(), register: vi.fn(), logout: vi.fn(), changePassword: vi.fn() }))
vi.mock('../api/account.js', () => ({ getAccount: vi.fn(), updateAccount: vi.fn() }))
vi.mock('../api/students.js', () => ({
  listStudents: vi.fn(),
  approveStudent: vi.fn(),
  rejectStudent: vi.fn(),
  bulkApproveStudents: vi.fn(),
  setStudentStatus: vi.fn(),
  resetUserPassword: vi.fn(),
  promoteYear: vi.fn(),
}))
vi.mock('../api/policies.js', () => ({ getPolicies: vi.fn(() => Promise.resolve({})) }))
vi.mock('../api/health.js', () => ({ getHealth: vi.fn(() => new Promise(() => {})) }))
vi.mock('../api/notifications.js', () => ({ getUnreadCount: vi.fn(() => Promise.resolve(0)), listNotifications: vi.fn() }))
vi.mock('../api/staffCases.js', () => ({ getCaseCounts: vi.fn(() => new Promise(() => {})) }))

const college = { id: 'c1', name: 'Alpha', code: 'alpha', branches: ['COMP', 'IT'], studentVerification: 'email_domain' }
const baseUser = { id: 's1', name: 'Asha Rao', email: 'asha@alpha.edu', role: 'student', collegeId: 'c1', status: 'active', mustChangePassword: false, emailVerified: true, authMethods: ['password'], year: 2, branch: 'COMP' }
const account = (overrides = {}) => ({ ...baseUser, hasPassword: true, emailPrefs: { caseUpdates: true, advisories: true, staffAlerts: true }, ...overrides })

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

describe('AccountPage (G22)', () => {
  it('shows email status and sign-in methods, saves the profile and toggles preferences', async () => {
    getMe.mockResolvedValue({ user: baseUser, college })
    getAccount.mockResolvedValue(account())
    updateAccount.mockImplementation(async (changes) => account({ ...changes, emailPrefs: { caseUpdates: true, advisories: changes.emailPrefs?.advisories ?? true, staffAlerts: true } }))
    const user = userEvent.setup()
    renderAt('/account')

    expect(await screen.findByRole('heading', { name: 'Account' })).toBeInTheDocument()
    expect(await screen.findByText('Email verified')).toBeInTheDocument()
    expect(screen.getByText('Email and password')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Change password' })).toHaveAttribute('href', '/change-password')
    // Students see case and advisory emails, not staff alerts.
    expect(screen.queryByLabelText(/New requests and students waiting/)).not.toBeInTheDocument()

    await user.clear(screen.getByLabelText('Full name'))
    await user.type(screen.getByLabelText('Full name'), 'Asha R')
    await user.selectOptions(screen.getByLabelText('Year'), '3')
    await user.selectOptions(screen.getByLabelText('Branch'), 'IT')
    await user.click(screen.getByRole('button', { name: 'Save profile' }))
    await waitFor(() => expect(updateAccount).toHaveBeenCalledWith({ name: 'Asha R', year: 3, branch: 'IT' }))
    expect(await screen.findByText('Profile saved.')).toBeInTheDocument()

    await user.click(screen.getByLabelText('Warning and critical advisories'))
    await waitFor(() => expect(updateAccount).toHaveBeenLastCalledWith({ emailPrefs: { advisories: false } }))
    expect(screen.queryByLabelText(/Email address/)).not.toBeInTheDocument()
  })

  it('a Google-only account has no change-password option; staff see the staff-alert toggle', async () => {
    const head = { ...baseUser, id: 'h1', role: 'tpo_head', year: null, branch: null, authMethods: ['google'] }
    getMe.mockResolvedValue({ user: head, college })
    getAccount.mockResolvedValue(account({ ...head, hasPassword: false }))
    listStudents.mockResolvedValue({ students: [], total: 0, pendingCount: 0, page: 1, limit: 100 })
    const user = userEvent.setup()
    renderAt('/account')
    expect(await screen.findByText('Google')).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Change password' })).not.toBeInTheDocument()
    expect(screen.getByLabelText('New requests and students waiting for approval')).toBeChecked()
    expect(screen.queryByLabelText('Year')).not.toBeInTheDocument()

    // The user menu offers Account but not Change password for a Google-only account.
    await user.click(screen.getByRole('button', { name: `Account menu for ${head.name}` }))
    const menu = await screen.findByRole('menu')
    expect(within(menu).getByRole('menuitem', { name: 'Account' })).toBeInTheDocument()
    expect(within(menu).queryByRole('menuitem', { name: 'Change password' })).not.toBeInTheDocument()
  })
})

describe('Promote year (G22)', () => {
  it('the TPO head sees the count in a confirmation dialog and promotes', async () => {
    const head = { ...baseUser, id: 'h1', role: 'tpo_head', year: null, branch: null }
    getMe.mockResolvedValue({ user: head, college })
    listStudents.mockImplementation(async (params) =>
      params.limit === 1 ? { students: [], total: params.year === 3 ? 42 : 7, pendingCount: 0, page: 1, limit: 1 } : { students: [], total: 0, pendingCount: 0, page: 1, limit: 100 },
    )
    promoteYear.mockResolvedValue({ promoted: 42, fromYear: 3, toYear: 4 })
    const user = userEvent.setup()
    renderAt('/staff/students?tab=active')

    await user.click(await screen.findByRole('button', { name: 'Promote year' }))
    const dialog = await screen.findByRole('dialog')
    expect(await within(dialog).findByText('7 active students in year 4 will move to year 5.')).toBeInTheDocument()
    expect(within(dialog).getByText('Run after results each June, starting with the final year so nobody is promoted twice.')).toBeInTheDocument()
    await user.selectOptions(within(dialog).getByLabelText('Students now in'), '3')
    expect(await within(dialog).findByText('42 active students in year 3 will move to year 4.')).toBeInTheDocument()
    await user.click(within(dialog).getByRole('button', { name: 'Promote to year 4' }))
    await waitFor(() => expect(promoteYear).toHaveBeenCalledWith(3))
    expect(await screen.findByText('42 students moved from year 3 to year 4.')).toBeInTheDocument()
  })

  it('officers do not see the control', async () => {
    getMe.mockResolvedValue({ user: { ...baseUser, id: 'o1', role: 'placement_officer', year: null, branch: null }, college })
    listStudents.mockResolvedValue({ students: [], total: 0, pendingCount: 0, page: 1, limit: 100 })
    renderAt('/staff/students?tab=active')
    expect(await screen.findByRole('heading', { name: 'Students' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Promote year' })).not.toBeInTheDocument()
  })
})
