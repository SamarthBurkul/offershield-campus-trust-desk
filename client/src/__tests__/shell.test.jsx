import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import App from '../App.jsx'
import { getCollege, listCollegeStaff, updateCollege } from '../api/admin.js'
import { getMe } from '../api/auth.js'
import { createRecruiter, listRecruiters } from '../api/registry.js'

vi.mock('../api/auth.js', () => ({ getMe: vi.fn(), login: vi.fn(), register: vi.fn(), logout: vi.fn(), changePassword: vi.fn() }))
vi.mock('../api/registry.js', () => ({
  listRecruiters: vi.fn(),
  createRecruiter: vi.fn(),
  approveRecruiter: vi.fn(),
  renewRecruiter: vi.fn(),
  suspendRecruiter: vi.fn(),
  listIndicators: vi.fn(() => Promise.resolve({ indicators: [] })),
  revokeIndicator: vi.fn(),
}))
vi.mock('../api/admin.js', () => ({
  listColleges: vi.fn(() => Promise.resolve([])),
  getCollege: vi.fn(),
  listCollegeStaff: vi.fn(),
  updateCollege: vi.fn(),
  rotateJoinCode: vi.fn(),
  createTpoHead: vi.fn(),
  resetTpoHeadPassword: vi.fn(),
}))
vi.mock('../api/staffCases.js', () => ({
  getCaseCounts: vi.fn(() => Promise.resolve({ open: 3, submitted: 1, under_review: 1, awaiting_student: 1, unassignedOpen: 1, staleOpen: 0, closed: 4 })),
  listStaffCases: vi.fn(() => Promise.resolve({ cases: [], page: 1, limit: 50, total: 0 })),
}))
vi.mock('../api/notifications.js', () => ({ getUnreadCount: vi.fn(() => Promise.resolve(0)), listNotifications: vi.fn() }))
vi.mock('../api/advisories.js', () => ({ listAdvisories: vi.fn(() => Promise.resolve([])) }))
vi.mock('../api/health.js', () => ({ getHealth: vi.fn(() => new Promise(() => {})) }))

const college = { id: 'c1', name: 'Demo Alpha Institute', code: 'demo-alpha', branches: ['COMP'], studentVerification: 'email_domain', isDemo: false }
const userOf = (role) => ({ id: `${role}-1`, name: `Test ${role}`, email: `${role}@alpha.demo.edu`, role, collegeId: role === 'super_admin' ? null : 'c1', status: 'active', mustChangePassword: false })
const signInAs = (role) => getMe.mockResolvedValue({ user: userOf(role), college: role === 'super_admin' ? null : college })
const renderAt = (path) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <App />
    </MemoryRouter>,
  )

afterEach(() => {
  vi.clearAllMocks()
})

describe('staff sidebar', () => {
  it('d1. shows Audit log and Staff only to the TPO head', async () => {
    signInAs('tpo_head')
    const { unmount } = renderAt('/staff')
    const headNav = within(await screen.findByRole('complementary', { name: 'Sidebar' }))
    for (const name of ['Home', 'Case desk', 'Students', 'Registry', 'Advisories', 'Stats', 'Audit log', 'Staff']) {
      expect(headNav.getByRole('link', { name: new RegExp(`^${name}`) })).toBeInTheDocument()
    }
    unmount()

    signInAs('placement_officer')
    renderAt('/staff')
    const officerNav = within(await screen.findByRole('complementary', { name: 'Sidebar' }))
    expect(officerNav.getByRole('link', { name: /^Case desk/ })).toBeInTheDocument()
    expect(officerNav.queryByRole('link', { name: 'Audit log' })).not.toBeInTheDocument()
    expect(officerNav.queryByRole('link', { name: 'Staff' })).not.toBeInTheDocument()
  })

  it('d2. the navigation drawer opens from the top-bar button (below lg) and closes with Escape', async () => {
    signInAs('placement_officer')
    const user = userEvent.setup()
    renderAt('/staff')

    const toggle = await screen.findByRole('button', { name: 'Open navigation' })
    await user.click(toggle)
    const drawer = screen.getByRole('dialog', { name: 'Navigation' })
    expect(within(drawer).getByRole('link', { name: /^Registry/ })).toBeInTheDocument()

    await user.keyboard('{Escape}')
    expect(screen.queryByRole('dialog', { name: 'Navigation' })).not.toBeInTheDocument()
    expect(toggle).toHaveFocus()
  })
})

describe('Drawer with the recruiter form', () => {
  it('c. opens, submits through the registry API and closes', async () => {
    signInAs('tpo_head')
    listRecruiters.mockResolvedValue({ recruiters: [], page: 1, limit: 50, total: 0 })
    createRecruiter.mockResolvedValue({ id: 'r9' })
    const user = userEvent.setup()
    renderAt('/staff/registry')

    await user.click(await screen.findByRole('button', { name: 'Add recruiter' }))
    const drawer = screen.getByRole('dialog', { name: 'Add recruiter' })
    const form = within(drawer).getByRole('form', { name: 'Recruiter form' })
    expect(within(form).getByLabelText('Company name')).toHaveFocus()

    await user.type(within(form).getByLabelText('Company name'), 'Northwind Systems')
    await user.type(within(form).getByLabelText('Official domains'), 'northwind.example')
    await user.click(within(form).getByLabelText('Checked the official careers page'))
    await user.type(within(form).getByLabelText('Evidence note'), 'Careers page lists this domain; HR confirmed by phone.')
    await user.click(within(form).getByRole('button', { name: 'Save verified recruiter' }))

    await waitFor(() =>
      expect(createRecruiter).toHaveBeenCalledWith(
        expect.objectContaining({ companyName: 'Northwind Systems', domains: ['northwind.example'], methods: ['checked_official_careers_page'] }),
      ),
    )
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Add recruiter' })).not.toBeInTheDocument())
    expect(await screen.findByText('Northwind Systems was added to the registry.')).toBeInTheDocument()
  })

  it('c2. the Close button closes the drawer without saving', async () => {
    signInAs('placement_officer')
    listRecruiters.mockResolvedValue({ recruiters: [], page: 1, limit: 50, total: 0 })
    const user = userEvent.setup()
    renderAt('/staff/registry')

    await user.click(await screen.findByRole('button', { name: 'Add recruiter' }))
    await user.click(within(screen.getByRole('dialog', { name: 'Add recruiter' })).getByRole('button', { name: 'Close' }))

    expect(screen.queryByRole('dialog', { name: 'Add recruiter' })).not.toBeInTheDocument()
    expect(createRecruiter).not.toHaveBeenCalled()
  })
})

describe('Landing page', () => {
  it('f. shows the hero, three sample lookup cards, four trust principles and the legal links', async () => {
    getMe.mockRejectedValue(Object.assign(new Error('401'), { response: { status: 401 } }))
    renderAt('/')

    expect(screen.getByRole('heading', { level: 1, name: /Check before you pay\. Ask before you share\./ })).toBeInTheDocument()
    const samples = screen.getAllByRole('group', { name: /^Sample lookup result/ })
    expect(samples.map((card) => card.getAttribute('data-status'))).toEqual(['verified', 'lookalike_warning', 'confirmed_fraud'])
    const principles = within(screen.getByRole('list', { name: 'Trust principles' })).getAllByRole('listitem')
    expect(principles).toHaveLength(4)
    expect(principles[1]).toHaveTextContent('It never certifies an offer as safe')
    expect(screen.getAllByRole('link', { name: /privacy/i }).some((link) => link.getAttribute('href') === '/privacy')).toBe(true)
    expect(screen.getAllByRole('link', { name: /terms/i }).some((link) => link.getAttribute('href') === '/terms')).toBe(true)
  })
})

describe('Admin college edit', () => {
  it('h. shows a "Saved" confirmation after a successful save, even though the card remounts', async () => {
    signInAs('super_admin')
    const details = { id: 'c1', name: 'Demo Alpha Institute', code: 'demo-alpha', emailDomains: ['alpha.demo.edu'], branches: ['COMP'], status: 'active', studentVerification: 'email_domain', isDemo: true, staffCount: 2, updatedAt: '2026-11-12T08:00:00.000Z' }
    getCollege.mockResolvedValue(details)
    listCollegeStaff.mockResolvedValue([])
    updateCollege.mockResolvedValue({ ...details, studentVerification: 'manual_approval', updatedAt: '2026-11-13T09:00:00.000Z' })
    const user = userEvent.setup()
    renderAt('/admin/colleges/c1')

    await user.selectOptions(await screen.findByLabelText('Student verification'), 'manual_approval')
    await user.click(screen.getByRole('button', { name: 'Save changes' }))

    expect(await screen.findByText(/^Saved\./)).toBeInTheDocument()
    expect(updateCollege).toHaveBeenCalledWith('c1', expect.objectContaining({ studentVerification: 'manual_approval' }))
    expect(screen.getByLabelText('Student verification')).toHaveValue('manual_approval')
  })
})
