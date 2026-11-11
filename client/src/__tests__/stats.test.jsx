import { render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import App from '../App.jsx'
import { getMe } from '../api/auth.js'
import { getStats } from '../api/stats.js'

vi.mock('../api/auth.js', () => ({ getMe: vi.fn(), login: vi.fn(), register: vi.fn(), logout: vi.fn(), changePassword: vi.fn() }))
vi.mock('../api/stats.js', () => ({ getStats: vi.fn() }))
vi.mock('../api/notifications.js', () => ({ getUnreadCount: vi.fn(() => Promise.resolve(0)), listNotifications: vi.fn() }))
vi.mock('../api/health.js', () => ({ getHealth: vi.fn(() => new Promise(() => {})) }))

const stats = {
  range: { from: '2026-08-13T00:00:00.000Z', to: '2026-11-11T00:00:00.000Z' },
  cases: {
    byStatus: { submitted: 2, under_review: 1, awaiting_student: 0, confirmed_fraud: 3, verified_genuine: 1, inconclusive: 0, dismissed: 0 },
    byChannel: { whatsapp: 5, email: 2, telegram: 0, linkedin: 0, instagram: 0, job_portal: 0, sms: 0, phone_call: 0, other: 0 },
    createdPerWeek: Array.from({ length: 8 }, (_, i) => ({ week: `2026-W${String(39 + i).padStart(2, '0')}`, weekStart: '2026-09-21', count: i === 7 ? 4 : 1 })),
    openCount: 3,
    staleOpenCount: 1,
    unassignedOpenCount: 2,
  },
  decisions: { byType: { confirmed_fraud: 3, verified_genuine: 1, inconclusive: 0, dismissed: 0 }, medianHoursToDecision: 15.5 },
  money: { casesWithFeeRequested: 4, totalAmountRequested: 3497, studentsReportedPaid: 1 },
  registry: { activeFraudIndicators: 2, verifiedRecruiters: 1, expiredRecruiters: 0, pendingRecruiters: 1 },
  lookups: { confirmed_fraud: 6, lookalike_warning: 2, verified: 3, verified_expired: 0, not_reviewed: 9 },
  advisories: { publishedCount: 1, overallAckRate: 0.5 },
  relatedCaseLinks: 2,
}

afterEach(() => {
  vi.clearAllMocks()
})

describe('StatsPage', () => {
  it('23. renders stat cards and CSS bar rows from the API', async () => {
    getMe.mockResolvedValue({ user: { id: 'h1', name: 'Head', email: 'h@alpha.demo.edu', role: 'tpo_head', collegeId: 'c1', status: 'active', mustChangePassword: false }, college: { id: 'c1', name: 'Demo Alpha', code: 'demo-alpha', branches: [] } })
    getStats.mockResolvedValue(stats)
    render(
      <MemoryRouter initialEntries={['/staff/stats']}>
        <App />
      </MemoryRouter>,
    )

    expect(await screen.findByText('Median hours to decision')).toBeInTheDocument()
    expect(screen.getByText('15.5')).toBeInTheDocument()
    expect(screen.getByText('₹3,497')).toBeInTheDocument()
    expect(screen.getByText('50%')).toBeInTheDocument()
    expect(screen.getByText('Open cases nobody has picked up.')).toBeInTheDocument()

    const byStatus = screen.getByRole('region', { name: 'Requests by status' })
    expect(within(byStatus).getAllByTestId('bar')).toHaveLength(7)
    expect(within(byStatus).getByText('Confirmed fraud')).toBeInTheDocument()
    const perWeek = screen.getByRole('region', { name: 'Requests per week' })
    expect(within(perWeek).getAllByTestId('bar')).toHaveLength(8)
    expect(within(perWeek).getByText('2026-W46')).toBeInTheDocument()
    expect(within(screen.getByRole('region', { name: 'Lookups by result' })).getByText('Look-alike warning')).toBeInTheDocument()
    expect(getStats).toHaveBeenCalledWith({ from: '', to: '' })
  })
})
