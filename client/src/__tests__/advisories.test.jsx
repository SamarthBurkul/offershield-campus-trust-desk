import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import App from '../App.jsx'
import { acknowledgeAdvisory, getAudienceCount, listAdvisories } from '../api/advisories.js'
import { getMe } from '../api/auth.js'
import { listIndicators } from '../api/registry.js'
import { getStaffCase } from '../api/staffCases.js'
import AdvisoryEditor from '../components/AdvisoryEditor.jsx'

vi.mock('../api/auth.js', () => ({ getMe: vi.fn(), login: vi.fn(), register: vi.fn(), logout: vi.fn(), changePassword: vi.fn() }))
vi.mock('../api/advisories.js', () => ({
  listAdvisories: vi.fn(),
  acknowledgeAdvisory: vi.fn(() => Promise.resolve({ acknowledged: true })),
  getAudienceCount: vi.fn(),
  createAdvisory: vi.fn(),
  updateAdvisory: vi.fn(),
  publishAdvisory: vi.fn(),
  getStaffAdvisory: vi.fn(),
  withdrawAdvisory: vi.fn(),
}))
vi.mock('../api/registry.js', () => ({ listIndicators: vi.fn() }))
vi.mock('../api/staffCases.js', () => ({ getStaffCase: vi.fn(), getCaseCounts: vi.fn(() => new Promise(() => {})) }))
vi.mock('../api/notifications.js', () => ({ getUnreadCount: vi.fn(() => Promise.resolve(0)), listNotifications: vi.fn() }))
vi.mock('../api/health.js', () => ({ getHealth: vi.fn(() => new Promise(() => {})) }))

const college = { id: 'c1', name: 'Demo Alpha', code: 'demo-alpha', branches: ['COMP', 'IT'] }
const userOf = (role, name = 'Test User') => ({ id: `${role}-1`, name, email: `${role}@alpha.demo.edu`, role, collegeId: 'c1', status: 'active', mustChangePassword: false })
const indicators = [
  { id: 'i1', type: 'upi', value: 'infosys.onboard@ybl', status: 'active', sourceCases: [] },
  { id: 'i2', type: 'domain', value: 'infosys-careers.in', status: 'active', sourceCases: [] },
  { id: 'i3', type: 'domain', value: 'unrelated-scam.xyz', status: 'active', sourceCases: [] },
]

afterEach(() => {
  vi.clearAllMocks()
})

describe('student home advisories', () => {
  it('20. shows unacknowledged advisories first; "I\'ve read this" acknowledges and hides the banner', async () => {
    getMe.mockResolvedValue({ user: userOf('student', 'Asha Rao'), college })
    listAdvisories.mockResolvedValue([
      { id: 'a1', title: 'Critical: fake Infosys internship', body: 'Do not pay the onboarding fee.', severity: 'critical', publishedAt: '2026-11-10T00:00:00.000Z', acknowledged: false, indicators: [{ type: 'upi', value: 'infosys.onboard@ybl' }] },
      { id: 'a2', title: 'Older acknowledged advisory', body: 'Already read.', severity: 'info', publishedAt: '2026-11-01T00:00:00.000Z', acknowledged: true, indicators: [] },
    ])
    const user = userEvent.setup()
    render(
      <MemoryRouter initialEntries={['/student']}>
        <App />
      </MemoryRouter>,
    )

    const banner = await screen.findByRole('region', { name: 'Advisories from your placement cell' })
    expect(within(banner).getByText('Critical: fake Infosys internship')).toBeInTheDocument()
    expect(within(banner).queryByText('Older acknowledged advisory')).not.toBeInTheDocument()
    expect(within(banner).getByText(/infosys\.onboard@ybl/)).toBeInTheDocument()
    const lookup = screen.getByRole('search')
    expect(banner.compareDocumentPosition(lookup) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()

    await user.click(within(banner).getByRole('button', { name: "I've read this" }))
    expect(acknowledgeAdvisory).toHaveBeenCalledWith('a1')
    await waitFor(() => expect(screen.queryByRole('region', { name: 'Advisories from your placement cell' })).not.toBeInTheDocument())
  })
})

describe('AdvisoryEditor', () => {
  const initial = { title: 'Fake Infosys internship offer', body: 'Genuine recruiters never charge fees. Do not pay anything.', severity: 'critical', indicatorIds: ['i1'] }

  it('21a. officers can only save drafts; the preview shows title, body and indicators', async () => {
    listIndicators.mockResolvedValue({ indicators })
    getAudienceCount.mockResolvedValue(12)
    render(<AdvisoryEditor initial={initial} isHead={false} branches={['COMP', 'IT']} onSave={vi.fn()} onPublish={vi.fn()} />)

    expect(await screen.findByRole('button', { name: 'Save draft' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Publish…' })).not.toBeInTheDocument()
    expect(await screen.findByText('12 students')).toBeInTheDocument()
    const preview = screen.getByRole('article', { name: 'Fake Infosys internship offer' })
    expect(preview).toHaveTextContent('Genuine recruiters never charge fees. Do not pay anything.')
    await waitFor(() => expect(preview).toHaveTextContent('UPI IDs: infosys.onboard@ybl'))
    expect(preview).not.toHaveTextContent('infosys-careers.in')
  })

  it('21b. the head publishes through a confirmation that states the audience count', async () => {
    listIndicators.mockResolvedValue({ indicators })
    getAudienceCount.mockResolvedValue(12)
    const onSave = vi.fn().mockResolvedValue({ id: 'adv1' })
    const onPublish = vi.fn().mockResolvedValue({})
    const user = userEvent.setup()
    render(<AdvisoryEditor initial={initial} isHead branches={['COMP', 'IT']} onSave={onSave} onPublish={onPublish} />)

    await user.click(screen.getByLabelText('Year 4'))
    await waitFor(() => expect(getAudienceCount).toHaveBeenLastCalledWith({ years: [4], branches: [] }))
    await user.click(await screen.findByRole('button', { name: 'Publish…' }))
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ target: { years: [4], branches: [] }, indicatorIds: ['i1'] }), null)
    const dialog = await screen.findByRole('dialog', { name: 'Publish this advisory?' })
    expect(dialog).toHaveTextContent('12 students')
    await user.click(within(dialog).getByRole('button', { name: 'Publish' }))
    expect(onPublish).toHaveBeenCalledWith('adv1')
  })
})

describe('Draft advisory from a case', () => {
  it('22. prefills title, body, indicators and source case without the student identity', async () => {
    getMe.mockResolvedValue({ user: userOf('placement_officer', 'Priya Officer'), college })
    listIndicators.mockResolvedValue({ indicators })
    getAudienceCount.mockResolvedValue(40)
    getStaffCase.mockResolvedValue({
      id: 'case3',
      caseNumber: 'OS-DEMO-ALPHA-0003',
      claimedCompany: 'Infosys',
      student: { id: 's1', name: 'Asha Rao', email: 'asha@alpha.demo.edu', year: 3, branch: 'COMP' },
      decision: {
        type: 'confirmed_fraud',
        confirmedIndicators: [
          { type: 'upi', value: 'infosys.onboard@ybl' },
          { type: 'domain', value: 'infosys-careers.in' },
        ],
      },
    })
    render(
      <MemoryRouter initialEntries={['/staff/advisories/new?fromCase=case3']}>
        <App />
      </MemoryRouter>,
    )

    const title = await screen.findByLabelText('Title')
    expect(title).toHaveValue('Fraudulent offer using the name "Infosys"')
    const body = screen.getByLabelText('Message to students')
    expect(body.value).toMatch(/Genuine recruiters never charge fees/)
    expect(body.value).not.toMatch(/Asha|asha@alpha/)
    await waitFor(() => expect(screen.getByLabelText('UPI IDs: infosys.onboard@ybl')).toBeChecked())
    expect(screen.getByLabelText('Websites / domains: infosys-careers.in')).toBeChecked()
    expect(screen.getByLabelText('Websites / domains: unrelated-scam.xyz')).not.toBeChecked()
    expect(screen.getByRole('combobox', { name: 'Severity' })).toHaveValue('critical')
    expect(screen.queryByRole('button', { name: 'Publish…' })).not.toBeInTheDocument()
  })
})
