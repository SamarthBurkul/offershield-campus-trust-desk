import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, useLocation } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import App from '../App.jsx'
import { getMe } from '../api/auth.js'
import { getCase } from '../api/cases.js'
import { getStaffCase, listStaffCases, recommend } from '../api/staffCases.js'

vi.mock('../api/auth.js', () => ({ getMe: vi.fn(), login: vi.fn(), register: vi.fn(), logout: vi.fn(), changePassword: vi.fn() }))
vi.mock('../api/staffCases.js', () => ({
  listStaffCases: vi.fn(),
  getCaseCounts: vi.fn(() => new Promise(() => {})),
  getStaffCase: vi.fn(),
  assignCase: vi.fn(),
  setCaseStatus: vi.fn(),
  requestInfo: vi.fn(),
  sendStaffMessage: vi.fn(),
  addNote: vi.fn(),
  recommend: vi.fn(),
  recordDecision: vi.fn(),
  reopenCase: vi.fn(),
}))
vi.mock('../api/staff.js', () => ({ listStaffMembers: vi.fn(() => Promise.resolve([])) }))
vi.mock('../api/cases.js', () => ({ getCase: vi.fn(), getEvidenceLink: vi.fn(), sendMessage: vi.fn(), uploadEvidence: vi.fn() }))
vi.mock('../api/health.js', () => ({ getHealth: vi.fn(() => new Promise(() => {})) }))

const college = { id: 'c1', name: 'Demo Alpha', code: 'demo-alpha', branches: ['COMP'] }
const people = {
  officer: { id: 'off1', name: 'Priya Officer', email: 'officer@alpha.demo.edu', role: 'placement_officer', collegeId: 'c1', status: 'active', mustChangePassword: false },
  head: { id: 'head1', name: 'Ravi Head', email: 'head@alpha.demo.edu', role: 'tpo_head', collegeId: 'c1', status: 'active', mustChangePassword: false },
  student: { id: 'stu1', name: 'Asha Rao', email: 'asha@alpha.demo.edu', role: 'student', collegeId: 'c1', status: 'active', mustChangePassword: false },
}
const signInAs = (who) => getMe.mockResolvedValue({ user: people[who], college })

function staffCase(overrides = {}) {
  return {
    id: 'case1',
    caseNumber: 'OS-DEMO-ALPHA-0001',
    claimedCompany: 'Fast Hiring Pvt Ltd',
    roleTitle: 'Data Intern',
    channel: 'whatsapp',
    receivedAt: '2026-11-09T00:00:00.000Z',
    messageText: 'Pay 499 to confirm.',
    links: [],
    contacts: { emails: [], phones: [], upiIds: [] },
    moneyRequested: { requested: true, amount: 499, purpose: 'registration' },
    paidAlready: false,
    documentsShared: false,
    studentNote: null,
    status: 'under_review',
    priority: 'high',
    isStale: false,
    indicators: [
      { type: 'upi', value: 'fees.desk@ybl', source: 'extracted' },
      { type: 'domain', value: 'xyz-careers.in', source: 'extracted' },
    ],
    student: { id: 'stu1', name: 'Asha Rao', email: 'asha@alpha.demo.edu', year: 3, branch: 'COMP' },
    assignee: null,
    recommendation: null,
    decision: null,
    decisionHistory: [],
    events: [
      { id: 'e1', type: 'created', actor: { id: 'stu1', name: 'Asha Rao', role: 'student' }, body: null, visibleToStudent: true, metadata: {}, createdAt: '2026-11-10T08:00:00.000Z' },
      { id: 'e2', type: 'assigned', actor: { id: 'head1', name: 'Ravi Head', role: 'tpo_head' }, body: null, visibleToStudent: false, metadata: { to: 'off1' }, createdAt: '2026-11-10T09:00:00.000Z' },
    ],
    notes: [],
    evidence: [],
    updatedAt: '2026-11-10T09:00:00.000Z',
    ...overrides,
  }
}

function LocationProbe() {
  const location = useLocation()
  return <output data-testid="location">{location.pathname + location.search}</output>
}

function renderAt(path) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <App />
      <LocationProbe />
    </MemoryRouter>,
  )
}

// clearAllMocks keeps the default implementations above (pending effects may still call them after a test).
afterEach(() => {
  vi.clearAllMocks()
})

describe('CaseQueuePage', () => {
  it('26. renders rows, sends filters and search, and keeps the tab in the URL', async () => {
    signInAs('officer')
    listStaffCases.mockResolvedValue({
      cases: [
        {
          id: 'case1',
          caseNumber: 'OS-DEMO-ALPHA-0001',
          claimedCompany: 'Fast Hiring Pvt Ltd',
          roleTitle: 'Data Intern',
          channel: 'whatsapp',
          status: 'submitted',
          priority: 'high',
          student: { name: 'Asha Rao', year: 3, branch: 'COMP' },
          assignee: null,
          evidenceCount: 1,
          lastActivityAt: new Date(Date.now() - 5 * 86_400_000).toISOString(),
          createdAt: '2026-11-01T00:00:00.000Z',
          isStale: true,
        },
      ],
      page: 1,
      limit: 20,
      total: 1,
    })
    const user = userEvent.setup()
    renderAt('/staff/cases')

    const row = (await screen.findByRole('link', { name: 'OS-DEMO-ALPHA-0001' })).closest('tr')
    expect(within(row).getByText('Fast Hiring Pvt Ltd')).toBeInTheDocument()
    expect(within(row).getByText('COMP-3')).toBeInTheDocument()
    expect(within(row).getByText('High')).toBeInTheDocument()
    expect(within(row).getByText('Stale')).toBeInTheDocument()
    expect(within(row).getByText('Unassigned')).toBeInTheDocument()
    // G23: below 1600 px Channel and Last activity fold under the company (jsdom checks the classes;
    // the real widths 1366/1440/1600 are checked in the browser smoke).
    const table = row.closest('table')
    for (const name of ['Channel', 'Last activity']) {
      expect(within(table).getByRole('columnheader', { name })).toHaveClass('hidden', 'min-[1600px]:table-cell')
    }
    const company = within(row).getByText('Fast Hiring Pvt Ltd').closest('td')
    expect(within(company).getByText('WhatsApp')).toBeInTheDocument()
    expect(within(company).getByText('· no recent activity')).toBeInTheDocument()
    expect(within(company).getByText('WhatsApp').closest('div')).toHaveClass('min-[1600px]:hidden')
    expect(listStaffCases).toHaveBeenLastCalledWith({ status: 'open', page: 1, limit: 20 })

    await user.selectOptions(screen.getByLabelText('Priority'), 'high')
    await waitFor(() => expect(listStaffCases).toHaveBeenLastCalledWith(expect.objectContaining({ priority: 'high', status: 'open' })))
    await user.selectOptions(screen.getByLabelText('Assignee'), 'me')
    await waitFor(() => expect(listStaffCases).toHaveBeenLastCalledWith(expect.objectContaining({ assignee: 'me' })))

    await user.type(screen.getByLabelText('Search cases'), '98765 43210')
    await user.click(screen.getByRole('button', { name: 'Search' }))
    await waitFor(() => expect(listStaffCases).toHaveBeenLastCalledWith(expect.objectContaining({ q: '98765 43210', priority: 'high' })))

    await user.click(screen.getByRole('tab', { name: 'Closed' }))
    await waitFor(() => expect(listStaffCases).toHaveBeenLastCalledWith(expect.objectContaining({ status: 'closed' })))
    const location = screen.getByTestId('location').textContent
    expect(location).toContain('/staff/cases?')
    expect(new URLSearchParams(location.split('?')[1]).get('status')).toBe('closed')
    expect(screen.getByRole('tab', { name: 'Closed' })).toHaveAttribute('aria-selected', 'true')
  })
})

describe('StaffCaseDetailPage', () => {
  it('27. marks internal events and the internal note tab says it is never shown to the student', async () => {
    signInAs('officer')
    getStaffCase.mockResolvedValue(staffCase())
    const user = userEvent.setup()
    renderAt('/staff/cases/case1')

    const timeline = await screen.findByRole('list', { name: 'Timeline' })
    expect(within(timeline).getByText('Internal')).toBeInTheDocument()
    expect(within(timeline).getByText('Visible to student')).toBeInTheDocument()

    await user.click(screen.getByRole('tab', { name: /Internal note/ }))
    expect(screen.getByText('Never shown to the student')).toBeInTheDocument()
  })

  it('28a. an officer sees the recommendation form but no decision form', async () => {
    signInAs('officer')
    getStaffCase.mockResolvedValue(staffCase())
    renderAt('/staff/cases/case1')

    expect(await screen.findByRole('button', { name: 'Add recommendation' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Record decision' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Assign to me' })).toBeInTheDocument()
  })

  it('28b. a TPO head sees the decision form', async () => {
    signInAs('head')
    getStaffCase.mockResolvedValue(staffCase({ recommendation: { type: 'confirmed_fraud', basis: 'UPI fee demand.', by: { name: 'Priya Officer' }, at: '2026-11-10T09:30:00.000Z' } }))
    renderAt('/staff/cases/case1')

    expect(await screen.findByRole('button', { name: 'Record decision' })).toBeInTheDocument()
    expect(screen.getByText('Recommended: Confirmed fraud')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Add recommendation' })).not.toBeInTheDocument()
    expect(screen.getByLabelText('Assignee')).toBeInTheDocument()
  })

  it('29. decision form validation for confirmed fraud and duplicate dismissal', async () => {
    signInAs('head')
    getStaffCase.mockResolvedValue(staffCase())
    const user = userEvent.setup()
    renderAt('/staff/cases/case1')

    const submit = await screen.findByRole('button', { name: 'Record decision' })
    expect(submit).toBeDisabled()
    const missing = () => screen.getByRole('list', { name: 'Missing before you can record' })

    await user.type(screen.getByLabelText('Basis (staff only)'), 'Too short')
    expect(missing()).toHaveTextContent('at least 30 characters')
    await user.type(screen.getByLabelText('Basis (staff only)'), ' — called the official HR line, no such role.')
    expect(missing()).not.toHaveTextContent('at least 30 characters')
    expect(submit).toBeDisabled()

    await user.click(screen.getByLabelText('Called the official company number'))
    expect(missing()).not.toHaveTextContent('check')
    expect(submit).toBeDisabled()

    await user.click(screen.getByLabelText('UPI IDs: fees.desk@ybl'))
    await user.type(screen.getByLabelText('Message to the student'), 'This offer is fraudulent. Do not pay.')
    expect(submit).toBeEnabled()
    expect(screen.getByLabelText('Student preview')).toHaveTextContent('This offer is fraudulent. Do not pay.')

    await user.selectOptions(screen.getByLabelText('Decision'), 'dismissed')
    await user.selectOptions(screen.getByLabelText('Dismiss reason'), 'duplicate')
    expect(missing()).toHaveTextContent('Choose the case this duplicates.')
    expect(submit).toBeDisabled()
  })

  it('30. a 409 shows the "updated by someone else" message', async () => {
    signInAs('officer')
    getStaffCase.mockResolvedValue(staffCase())
    recommend.mockRejectedValue(
      Object.assign(new Error('Request failed with status code 409'), {
        response: { status: 409, data: { error: { code: 'INVALID_TRANSITION', message: 'conflict' } } },
      }),
    )
    const user = userEvent.setup()
    renderAt('/staff/cases/case1')

    await user.type(await screen.findByLabelText('Why?'), 'Registration fee via UPI collect request.')
    await user.click(screen.getByRole('button', { name: 'Add recommendation' }))

    const messages = await screen.findAllByText(/updated by someone else/i)
    expect(messages.length).toBeGreaterThan(0)
    expect(screen.getByRole('button', { name: 'Refresh' })).toBeInTheDocument()
  })
})

describe('student outcome card', () => {
  it('31. a closed request shows the outcome message and no basis', async () => {
    signInAs('student')
    getCase.mockResolvedValue({
      case: {
        ...staffCase({ status: 'confirmed_fraud' }),
        decision: { type: 'confirmed_fraud', decidedAt: '2026-11-11T10:00:00.000Z', message: 'This offer is fraudulent. Do not pay anything.' },
      },
      events: [],
      evidence: [],
    })
    renderAt('/student/requests/case1')

    const outcome = await screen.findByRole('region', { name: 'Outcome' })
    expect(within(outcome).getByText('Your placement cell confirmed that this offer is fraudulent.')).toBeInTheDocument()
    expect(within(outcome).getByText('This offer is fraudulent. Do not pay anything.')).toBeInTheDocument()
    expect(screen.queryByText(/basis/i)).not.toBeInTheDocument()
    expect(screen.queryByLabelText('Reply to your placement cell')).not.toBeInTheDocument()
  })
})
