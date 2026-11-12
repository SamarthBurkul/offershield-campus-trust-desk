import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import App from '../App.jsx'
import { getMe } from '../api/auth.js'
import { listStaffMembers } from '../api/staff.js'
import { approveStudent, bulkApproveStudents, listStudents, rejectStudent, resetUserPassword } from '../api/students.js'

vi.mock('../api/auth.js', () => ({ getMe: vi.fn(), login: vi.fn(), register: vi.fn(), logout: vi.fn(), changePassword: vi.fn() }))
vi.mock('../api/students.js', () => ({
  listStudents: vi.fn(),
  approveStudent: vi.fn(),
  rejectStudent: vi.fn(),
  bulkApproveStudents: vi.fn(),
  setStudentStatus: vi.fn(),
  resetUserPassword: vi.fn(),
}))
vi.mock('../api/staff.js', () => ({ listStaffMembers: vi.fn(), createOfficer: vi.fn(), setOfficerStatus: vi.fn() }))
vi.mock('../api/staffCases.js', () => ({ getCaseCounts: vi.fn(() => new Promise(() => {})) }))
vi.mock('../api/notifications.js', () => ({ getUnreadCount: vi.fn(() => Promise.resolve(0)), listNotifications: vi.fn() }))
vi.mock('../api/health.js', () => ({ getHealth: vi.fn(() => new Promise(() => {})) }))

const college = { id: 'c1', name: 'Demo College', code: 'demo', branches: ['COMP', 'IT'], studentVerification: 'manual_approval', isDemo: false }
const people = {
  officer: { id: 'off1', name: 'Priya Officer', email: 'officer@demo.edu', role: 'placement_officer', collegeId: 'c1', status: 'active', mustChangePassword: false },
  head: { id: 'head1', name: 'Ravi Head', email: 'head@demo.edu', role: 'tpo_head', collegeId: 'c1', status: 'active', mustChangePassword: false },
}
const student = (id, name, status) => ({ id, name, email: `${id}@gmail.com`, year: 3, branch: 'COMP', status, createdAt: '2026-11-10T08:00:00.000Z' })
const PENDING = [student('p1', 'Kiran Pending', 'pending_approval'), student('p2', 'Meera Pending', 'pending_approval')]
const ACTIVE = [student('a1', 'Asha Active', 'active')]

function mockStudents() {
  listStudents.mockImplementation(({ status }) => {
    const students = status === 'pending_approval' ? PENDING : status === 'active' ? ACTIVE : []
    return Promise.resolve({ students, total: students.length, page: 1, limit: 100, pendingCount: PENDING.length })
  })
}

function renderAt(path, who = 'officer') {
  getMe.mockResolvedValue({ user: people[who], college })
  return render(
    <MemoryRouter initialEntries={[path]}>
      <App />
    </MemoryRouter>,
  )
}

afterEach(() => {
  vi.clearAllMocks()
})

describe('StaffStudentsPage', () => {
  it('16a. opens on the Pending tab for a manual-approval college and switches tabs', async () => {
    mockStudents()
    const user = userEvent.setup()
    renderAt('/staff/students')

    expect(await screen.findByText('Kiran Pending')).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Pending (2)' })).toHaveAttribute('aria-selected', 'true')
    expect(listStudents).toHaveBeenCalledWith(expect.objectContaining({ status: 'pending_approval' }))

    await user.click(screen.getByRole('tab', { name: 'Active' }))
    expect(await screen.findByText('Asha Active')).toBeInTheDocument()
    expect(listStudents).toHaveBeenLastCalledWith(expect.objectContaining({ status: 'active' }))

    await user.click(screen.getByRole('tab', { name: 'Disabled' }))
    expect(await screen.findByText('No disabled students')).toBeInTheDocument()
  })

  it('16b. approves one student, and bulk approves the selected ones', async () => {
    mockStudents()
    approveStudent.mockResolvedValue({ ...PENDING[0], status: 'active' })
    bulkApproveStudents.mockResolvedValue({ approved: ['p1', 'p2'], skipped: 0 })
    const user = userEvent.setup()
    renderAt('/staff/students?tab=pending')

    const row = (await screen.findByText('Kiran Pending')).closest('tr')
    await user.click(within(row).getByRole('button', { name: 'Approve' }))
    await waitFor(() => expect(approveStudent).toHaveBeenCalledWith('p1'))
    expect(await screen.findByText('Kiran Pending approved.')).toBeInTheDocument()

    await user.click(await screen.findByRole('checkbox', { name: 'Select Kiran Pending' }))
    await user.click(screen.getByRole('checkbox', { name: 'Select Meera Pending' }))
    await user.click(screen.getByRole('button', { name: 'Approve selected (2)' }))
    await waitFor(() => expect(bulkApproveStudents).toHaveBeenCalledWith(['p1', 'p2']))
    expect(await screen.findByText('2 students approved.')).toBeInTheDocument()
  })

  it('16c. rejects with an optional reason typed in the dialog', async () => {
    mockStudents()
    rejectStudent.mockResolvedValue({ ...PENDING[1], status: 'rejected' })
    const user = userEvent.setup()
    renderAt('/staff/students?tab=pending')

    const row = (await screen.findByText('Meera Pending')).closest('tr')
    await user.click(within(row).getByRole('button', { name: 'Reject' }))
    const reason = screen.getByLabelText('Reason (optional, staff only)')
    await user.type(reason, 'Not on the enrolment list for this year')
    expect(reason).toHaveFocus()
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Reject' }))

    await waitFor(() => expect(rejectStudent).toHaveBeenCalledWith('p2', 'Not on the enrolment list for this year'))
  })

  it('16d. reset password shows the temporary password once', async () => {
    mockStudents()
    resetUserPassword.mockResolvedValue({ user: ACTIVE[0], temporaryPassword: 'TempPass2345abcd' })
    const user = userEvent.setup()
    renderAt('/staff/students?tab=active')

    const row = (await screen.findByText('Asha Active')).closest('tr')
    await user.click(within(row).getByRole('button', { name: 'Reset password' }))

    const secret = await screen.findByRole('region', { name: 'Temporary password for a1@gmail.com' })
    expect(within(secret).getByText('TempPass2345abcd')).toBeInTheDocument()
    expect(within(secret).getByText(/shown only once/i)).toBeInTheDocument()
    await user.click(within(secret).getByRole('button', { name: 'I have saved it' }))
    expect(screen.queryByText('TempPass2345abcd')).not.toBeInTheDocument()
  })

  it('the staff home shows the pending count for manual-approval colleges', async () => {
    mockStudents()
    renderAt('/staff')

    const link = await screen.findByRole('link', { name: /Students awaiting approval/ })
    await waitFor(() => expect(link).toHaveTextContent('2'))
    expect(link).toHaveAttribute('href', '/staff/students?tab=pending')
  })
})

describe('StaffMembersPage password reset', () => {
  const members = [
    { id: 'head1', name: 'Ravi Head', email: 'head@demo.edu', role: 'tpo_head', status: 'active' },
    { id: 'off1', name: 'Priya Officer', email: 'officer@demo.edu', role: 'placement_officer', status: 'active' },
  ]

  it('16e. officers see no reset action on officer accounts', async () => {
    listStaffMembers.mockResolvedValue(members)
    renderAt('/staff/members', 'officer')

    expect(await screen.findByText('officer@demo.edu')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Reset password' })).not.toBeInTheDocument()
  })

  it('16f. the TPO head can reset an officer and sees the one-time password', async () => {
    listStaffMembers.mockResolvedValue(members)
    resetUserPassword.mockResolvedValue({ user: members[1], temporaryPassword: 'OfficerTemp23456' })
    const user = userEvent.setup()
    renderAt('/staff/members', 'head')

    const row = (await screen.findByText('officer@demo.edu')).closest('tr')
    await user.click(within(row).getByRole('button', { name: 'Reset password' }))

    expect(resetUserPassword).toHaveBeenCalledWith('off1')
    expect(await screen.findByText('OfficerTemp23456')).toBeInTheDocument()
    // No reset action on the head's own row.
    expect(within(screen.getByText('head@demo.edu').closest('tr')).queryByRole('button', { name: 'Reset password' })).not.toBeInTheDocument()
  })
})
