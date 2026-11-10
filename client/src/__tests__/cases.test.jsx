import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from '../App.jsx'
import { getMe } from '../api/auth.js'
import { createCase, getCase, listMyCases, uploadEvidence } from '../api/cases.js'

vi.mock('../api/auth.js', () => ({
  getMe: vi.fn(),
  login: vi.fn(),
  register: vi.fn(),
  logout: vi.fn(),
  changePassword: vi.fn(),
}))
vi.mock('../api/cases.js', () => ({
  createCase: vi.fn(),
  listMyCases: vi.fn(),
  getCase: vi.fn(),
  sendMessage: vi.fn(),
  uploadEvidence: vi.fn(),
  getEvidenceLink: vi.fn(),
}))
vi.mock('../api/health.js', () => ({ getHealth: vi.fn(() => new Promise(() => {})) }))

const student = {
  id: 'u1',
  name: 'Asha Rao',
  email: 'asha@alpha.demo.edu',
  role: 'student',
  collegeId: 'c1',
  status: 'active',
  mustChangePassword: false,
}

function caseDetail(overrides = {}) {
  return {
    case: {
      id: 'case1',
      caseNumber: 'OS-DEMO-ALPHA-0001',
      claimedCompany: 'Fast Hiring Pvt Ltd',
      roleTitle: 'Data Intern',
      channel: 'whatsapp',
      receivedAt: '2026-11-09T00:00:00.000Z',
      messageText: 'Pay 499 to confirm your internship seat.',
      links: [],
      contacts: { emails: [], phones: [], upiIds: [] },
      moneyRequested: { requested: true, amount: 499, purpose: 'registration' },
      paidAlready: false,
      documentsShared: false,
      studentNote: null,
      status: 'submitted',
      indicators: [
        { type: 'upi', value: 'fees.desk@ybl', source: 'extracted' },
        { type: 'domain', value: 'xyz-careers.in', source: 'extracted' },
        { type: 'phone', value: '+919876543210', source: 'student_entered' },
      ],
      decision: null,
      createdAt: '2026-11-10T08:00:00.000Z',
      ...overrides,
    },
    events: [
      { id: 'e1', type: 'created', actor: 'student', body: null, metadata: {}, createdAt: '2026-11-10T08:00:00.000Z' },
      { id: 'e2', type: 'student_message', actor: 'student', body: 'They called me again today.', metadata: {}, createdAt: '2026-11-10T09:00:00.000Z' },
    ],
    evidence: [{ id: 'ev1', originalName: 'chat.png', mime: 'image/png', size: 2048, createdAt: '2026-11-10T08:01:00.000Z' }],
  }
}

function renderAt(path) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <App />
    </MemoryRouter>,
  )
}

async function fillRequiredFields(user) {
  await user.type(await screen.findByLabelText('Company name (as claimed)'), 'Fast Hiring Pvt Ltd')
  await user.type(screen.getByLabelText('Message you received'), 'Pay 499 to confirm your internship seat.')
}

beforeEach(() => {
  getMe.mockResolvedValue({ user: student, college: { id: 'c1', name: 'Demo Alpha', code: 'demo-alpha', branches: [] } })
})
afterEach(() => {
  vi.resetAllMocks()
})

describe('NewRequestPage', () => {
  it('34. blocks submit without consent and shows file type and size errors', async () => {
    const user = userEvent.setup({ applyAccept: false })
    renderAt('/student/requests/new')
    await fillRequiredFields(user)

    await user.click(screen.getByRole('button', { name: 'Submit request' }))
    expect(await screen.findByText(/confirm the consent statement/i)).toBeInTheDocument()
    expect(createCase).not.toHaveBeenCalled()

    const picker = screen.getByLabelText('Evidence files')
    await user.upload(picker, [
      new File(['hello'], 'notes.txt', { type: 'text/plain' }),
      new File([new Uint8Array(3 * 1024 * 1024 + 1)], 'huge.png', { type: 'image/png' }),
      new File([new Uint8Array(10)], 'ok.png', { type: 'image/png' }),
    ])

    const errors = (await screen.findAllByRole('alert')).find((node) => node.tagName === 'UL')
    expect(errors).toHaveTextContent('notes.txt: only PNG, JPEG and PDF files are allowed.')
    expect(errors).toHaveTextContent('huge.png')
    expect(errors).toHaveTextContent(/over the 3 MB limit/)
    expect(screen.getByText('ok.png')).toBeInTheDocument()
  })

  it('35. creates the case, then uploads evidence, then opens the detail page', async () => {
    const order = []
    createCase.mockImplementation(async () => {
      order.push('create')
      return { id: 'case1' }
    })
    uploadEvidence.mockImplementation(async () => {
      order.push('upload')
      return []
    })
    getCase.mockResolvedValue(caseDetail())
    const user = userEvent.setup()
    renderAt('/student/requests/new')
    await fillRequiredFields(user)

    const screenshot = new File([new Uint8Array(100)], 'chat.png', { type: 'image/png' })
    await user.upload(screen.getByLabelText('Evidence files'), screenshot)
    await user.click(screen.getByLabelText(/I confirm the details are true/))
    await user.click(screen.getByRole('button', { name: 'Submit request' }))

    expect(await screen.findByRole('heading', { level: 1, name: 'Fast Hiring Pvt Ltd' })).toBeInTheDocument()
    expect(order).toEqual(['create', 'upload'])
    expect(createCase).toHaveBeenCalledWith(
      expect.objectContaining({ claimedCompany: 'Fast Hiring Pvt Ltd', channel: 'whatsapp', consent: true, moneyRequested: { requested: false } }),
    )
    expect(uploadEvidence).toHaveBeenCalledWith('case1', [screenshot])
    expect(getCase).toHaveBeenCalledWith('case1')
  })

  it('36. shows SENSITIVE_ID_DETECTED from the server', async () => {
    const message = 'Your request appears to contain an Aadhaar or PAN number. Please remove it or mask it.'
    createCase.mockRejectedValue(
      Object.assign(new Error('Request failed with status code 400'), {
        response: { status: 400, data: { error: { code: 'SENSITIVE_ID_DETECTED', message } } },
      }),
    )
    const user = userEvent.setup()
    renderAt('/student/requests/new')
    await fillRequiredFields(user)
    await user.click(screen.getByLabelText(/I confirm the details are true/))
    await user.click(screen.getByRole('button', { name: 'Submit request' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(message)
    expect(uploadEvidence).not.toHaveBeenCalled()
  })
})

describe('MyRequestsPage', () => {
  it('37. renders student-facing status labels', async () => {
    const statuses = ['submitted', 'under_review', 'awaiting_student', 'confirmed_fraud', 'verified_genuine', 'inconclusive', 'dismissed']
    listMyCases.mockResolvedValue({
      cases: statuses.map((status, i) => ({
        id: `c${i}`,
        caseNumber: `OS-DEMO-ALPHA-000${i + 1}`,
        claimedCompany: `Company ${i}`,
        channel: 'email',
        status,
        receivedAt: '2026-11-09T00:00:00.000Z',
        createdAt: '2026-11-10T00:00:00.000Z',
      })),
      page: 1,
      limit: 50,
      total: statuses.length,
    })

    renderAt('/student/requests')

    const list = await screen.findByRole('list')
    for (const label of [
      'Received',
      'Being reviewed',
      'Needs your reply',
      'Confirmed fraud',
      'Verified by placement cell',
      'Could not verify',
      'Closed',
    ]) {
      expect(within(list).getByText(label)).toBeInTheDocument()
    }
    expect(within(list).queryByText('under_review')).not.toBeInTheDocument()
  })
})

describe('RequestDetailPage', () => {
  it('38a. shows the timeline, indicators and evidence with a reply box for open cases', async () => {
    getCase.mockResolvedValue(caseDetail())

    renderAt('/student/requests/case1')

    const timeline = await screen.findByRole('list', { name: 'Timeline' })
    expect(within(timeline).getByText('Request submitted')).toBeInTheDocument()
    expect(within(timeline).getByText('They called me again today.')).toBeInTheDocument()
    expect(screen.getByText('fees.desk@ybl')).toBeInTheDocument()
    expect(screen.getByText('xyz-careers.in')).toBeInTheDocument()
    expect(screen.getByText('UPI IDs')).toBeInTheDocument()
    expect(screen.getByText('chat.png')).toBeInTheDocument()
    expect(screen.getByLabelText('Reply to your placement cell')).toBeInTheDocument()
    expect(screen.getByLabelText('Add more evidence')).toBeInTheDocument()
    expect(screen.getByText(/only ever come from a decision by your placement cell/i)).toBeInTheDocument()
  })

  it('38b. hides the reply box and evidence upload for a closed case', async () => {
    getCase.mockResolvedValue(caseDetail({ status: 'verified_genuine' }))

    renderAt('/student/requests/case1')

    expect(await screen.findByText('Verified by placement cell')).toBeInTheDocument()
    await waitFor(() => expect(screen.queryByLabelText('Reply to your placement cell')).not.toBeInTheDocument())
    expect(screen.queryByLabelText('Add more evidence')).not.toBeInTheDocument()
    expect(screen.getByText(/replies are turned off/i)).toBeInTheDocument()
  })
})
