import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import App from '../App.jsx'
import { getMe } from '../api/auth.js'
import { lookup } from '../api/lookup.js'
import { listRecruiters } from '../api/registry.js'
import { getStaffCase } from '../api/staffCases.js'
import LookupResultCard from '../components/LookupResultCard.jsx'
import SignalsPanel from '../components/SignalsPanel.jsx'

vi.mock('../api/auth.js', () => ({ getMe: vi.fn(), login: vi.fn(), register: vi.fn(), logout: vi.fn(), changePassword: vi.fn() }))
vi.mock('../api/lookup.js', () => ({ lookup: vi.fn() }))
vi.mock('../api/registry.js', () => ({
  listRecruiters: vi.fn(),
  listIndicators: vi.fn(() => Promise.resolve({ indicators: [], page: 1, limit: 100, total: 0 })),
  createRecruiter: vi.fn(),
  updateRecruiter: vi.fn(),
  approveRecruiter: vi.fn(),
  renewRecruiter: vi.fn(),
  suspendRecruiter: vi.fn(),
  revokeIndicator: vi.fn(),
}))
vi.mock('../api/staffCases.js', () => ({
  listStaffCases: vi.fn(() => new Promise(() => {})),
  getCaseCounts: vi.fn(() => new Promise(() => {})),
  getStaffCase: vi.fn(),
}))
vi.mock('../api/staff.js', () => ({ listStaffMembers: vi.fn(() => Promise.resolve([])) }))
vi.mock('../api/health.js', () => ({ getHealth: vi.fn(() => new Promise(() => {})) }))

const college = { id: 'c1', name: 'Demo Alpha', code: 'demo-alpha', branches: ['COMP'] }
const user = (role, name = 'Test User') => ({ id: `${role}-1`, name, email: `${role}@alpha.demo.edu`, role, collegeId: 'c1', status: 'active', mustChangePassword: false })
const signInAs = (role) => getMe.mockResolvedValue({ user: user(role), college })

const recruiter = {
  id: 'r1',
  companyName: 'Infosys',
  domains: ['infosys.com'],
  methods: ['called_official_number', 'checked_official_careers_page'],
  verifiedAt: '2026-11-01T00:00:00.000Z',
  expiresAt: '2027-11-01T00:00:00.000Z',
  isExpired: false,
}
const results = {
  confirmed_fraud: { resultStatus: 'confirmed_fraud', queryType: 'upi', fraudMatches: [{ type: 'upi', value: 'x@ybl', confirmedAt: '2026-11-05T00:00:00.000Z' }], verifiedRecruiters: [], lookalikeOf: [] },
  lookalike_warning: { resultStatus: 'lookalike_warning', queryType: 'domain', fraudMatches: [], verifiedRecruiters: [], lookalikeOf: [{ companyName: 'Infosys', domain: 'infosys.com' }] },
  verified: { resultStatus: 'verified', queryType: 'domain', fraudMatches: [], verifiedRecruiters: [recruiter], lookalikeOf: [] },
  verified_expired: { resultStatus: 'verified_expired', queryType: 'domain', fraudMatches: [], verifiedRecruiters: [{ ...recruiter, isExpired: true, expiresAt: '2026-01-01T00:00:00.000Z' }], lookalikeOf: [] },
  not_reviewed: { resultStatus: 'not_reviewed', queryType: 'domain', fraudMatches: [], verifiedRecruiters: [], lookalikeOf: [] },
}

const renderAt = (path) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <App />
    </MemoryRouter>,
  )

afterEach(() => {
  vi.clearAllMocks()
})

describe('LookupResultCard', () => {
  it.each([
    ['confirmed_fraud', 'bg-rose-50', /fraudulent offer on .*Do not pay or share documents.*call 1930.*cybercrime\.gov\.in/],
    ['lookalike_warning', 'bg-amber-50', /looks similar to infosys\.com \(Infosys\).*different address/],
    ['verified', 'bg-emerald-50', /Infosys was verified by your placement cell on .* using: Called the official company number, Checked the official careers page\. Valid until .*come only from: infosys\.com/],
    ['verified_expired', 'bg-slate-100', /Verification expired on /],
    ['not_reviewed', 'bg-white', /has not reviewed this yet\. Not reviewed does not mean safe\./],
  ])('38. %s renders its message and colour', (status, colour, text) => {
    render(
      <MemoryRouter>
        <LookupResultCard result={results[status]} query="example.com" />
      </MemoryRouter>,
    )
    const card = screen.getByRole('status', { name: 'Lookup result' })
    expect(card).toHaveAttribute('data-status', status)
    expect(card.className).toContain(colour)
    expect(card).toHaveTextContent(text)
    expect(within(card).getByRole('button', { name: 'Ask your placement cell to verify' })).toBeInTheDocument()
  })
})

describe('Ask your placement cell', () => {
  it('39. pre-fills the new request form from the lookup', async () => {
    signInAs('student')
    lookup.mockResolvedValue(results.not_reviewed)
    const u = userEvent.setup()
    renderAt('/student')

    await u.type(await screen.findByLabelText('Look up'), 'infosys-careers.in')
    await u.click(screen.getByRole('button', { name: 'Check' }))
    expect(lookup).toHaveBeenCalledWith('infosys-careers.in')
    expect(await screen.findByText(/does not mean safe/)).toBeInTheDocument()

    await u.click(screen.getByRole('button', { name: 'Ask your placement cell to verify' }))
    expect(await screen.findByRole('heading', { name: /verify an offer/i })).toBeInTheDocument()
    expect(screen.getByLabelText('Links 1')).toHaveValue('https://infosys-careers.in')
  })

  it('39b. a company query pre-fills the company name', async () => {
    signInAs('student')
    renderAt('/student/requests/new?company=Infosys%20Ltd')
    expect(await screen.findByLabelText('Company name (as claimed)')).toHaveValue('Infosys Ltd')
  })
})

describe('SignalsPanel', () => {
  it('40. says the signals are automated hints, not a decision', () => {
    render(<SignalsPanel signals={[{ code: 'FEE_REQUESTED', severity: 'high', message: 'A fee or deposit was requested', detail: { phrase: 'onboarding fee' } }]} onRecompute={vi.fn()} />)
    expect(screen.getByText('Automated hints — not a decision')).toBeInTheDocument()
    expect(screen.getByText('Fee requested', { exact: false })).toBeInTheDocument()
    expect(screen.getByText('“onboarding fee”')).toBeInTheDocument()
  })
})

describe('verified_genuine → recruiter registry', () => {
  it('41. the head sees "Add to recruiter registry", which opens a pre-filled form', async () => {
    signInAs('tpo_head')
    getStaffCase.mockResolvedValue({
      id: 'case1',
      caseNumber: 'OS-DEMO-ALPHA-0007',
      claimedCompany: 'Infosys',
      roleTitle: null,
      channel: 'email',
      receivedAt: '2026-11-09T00:00:00.000Z',
      messageText: 'Campus drive invitation.',
      contacts: { emails: [], phones: [], upiIds: [] },
      moneyRequested: { requested: false, amount: null, purpose: null },
      status: 'verified_genuine',
      priority: 'normal',
      indicators: [{ type: 'domain', value: 'infosys.com', source: 'extracted' }],
      student: null,
      assignee: null,
      recommendation: null,
      decision: {
        type: 'verified_genuine',
        basis: 'Matched official careers page and called HR.',
        checks: ['checked_official_careers_page', 'called_official_number'],
        studentMessage: 'This invitation is real.',
        confirmedIndicators: [],
        verifiedDomains: ['infosys.com'],
        decidedBy: { id: 'tpo_head-1', name: 'Head' },
        decidedAt: '2026-11-10T00:00:00.000Z',
      },
      decisionHistory: [],
      signals: [],
      related: [],
      events: [],
      notes: [],
      evidence: [],
    })
    const u = userEvent.setup()
    renderAt('/staff/cases/case1')

    await u.click(await screen.findByRole('button', { name: 'Add to recruiter registry' }))
    const form = await screen.findByRole('form', { name: 'Recruiter form' })
    expect(within(form).getByLabelText('Company name')).toHaveValue('Infosys')
    expect(within(form).getByLabelText('Official domains')).toHaveValue('infosys.com')
    expect(within(form).getByLabelText('Checked the official careers page')).toBeChecked()
    expect(within(form).getByLabelText('Called the official company number')).toBeChecked()
    expect(within(form).getByLabelText('MCA or GST lookup')).not.toBeChecked()
  })
})

describe('RegistryPage', () => {
  const recruiters = {
    recruiters: [
      { id: 'r1', companyName: 'Infosys', domains: ['infosys.com'], status: 'verified', isExpired: false, verification: { verifiedAt: '2026-11-01T00:00:00.000Z', expiresAt: '2027-11-01T00:00:00.000Z' } },
      { id: 'r2', companyName: 'Pending Co', domains: ['pending.com'], status: 'pending_approval', isExpired: false, verification: { verifiedAt: null, expiresAt: null } },
    ],
    page: 1,
    limit: 50,
    total: 2,
  }

  it('42a. the head sees approve, renew and suspend', async () => {
    signInAs('tpo_head')
    listRecruiters.mockResolvedValue(recruiters)
    renderAt('/staff/registry')

    const u = userEvent.setup()
    expect(await screen.findByRole('button', { name: 'Approve' })).toBeInTheDocument()
    // Phase 8: Renew and Suspend live in each row's actions menu.
    await u.click(screen.getByRole('button', { name: 'Actions for Infosys' }))
    expect(screen.getByRole('menuitem', { name: 'Renew' })).toBeInTheDocument()
    expect(screen.getByRole('menuitem', { name: 'Suspend' })).toBeInTheDocument()
    await u.click(screen.getByRole('button', { name: 'Actions for Pending Co' }))
    expect(screen.getByRole('menuitem', { name: 'Suspend' })).toBeInTheDocument()
    expect(screen.queryByRole('menuitem', { name: 'Renew' })).not.toBeInTheDocument()
    expect(screen.getByText('Pending approval')).toBeInTheDocument()
  })

  it('42b. an officer sees the list but no approve, renew or suspend controls', async () => {
    signInAs('placement_officer')
    listRecruiters.mockResolvedValue(recruiters)
    renderAt('/staff/registry')

    expect(await screen.findByText('Pending Co')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Approve' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Renew' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Suspend' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Actions for/ })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Add recruiter' })).toBeInTheDocument()
  })
})
