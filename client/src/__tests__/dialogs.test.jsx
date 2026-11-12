import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useEffect, useState } from 'react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import App from '../App.jsx'
import { getStaffAdvisory, withdrawAdvisory } from '../api/advisories.js'
import { getMe } from '../api/auth.js'
import ConfirmDialog from '../components/ConfirmDialog.jsx'
import ReopenDialog from '../components/ReopenDialog.jsx'
import { TextAreaField, TextField } from '../components/ui.jsx'

vi.mock('../api/auth.js', () => ({ getMe: vi.fn(), login: vi.fn(), register: vi.fn(), logout: vi.fn(), changePassword: vi.fn() }))
vi.mock('../api/advisories.js', () => ({
  listStaffAdvisories: vi.fn(),
  getStaffAdvisory: vi.fn(),
  withdrawAdvisory: vi.fn(),
  createAdvisory: vi.fn(),
  updateAdvisory: vi.fn(),
  publishAdvisory: vi.fn(),
  getAudienceCount: vi.fn(),
}))
vi.mock('../api/notifications.js', () => ({ getUnreadCount: vi.fn(() => Promise.resolve(0)), listNotifications: vi.fn() }))
vi.mock('../api/health.js', () => ({ getHealth: vi.fn(() => new Promise(() => {})) }))

// 40+ characters, with spaces and punctuation, typed one key at a time.
const LONG_REASON = 'Student brought the full chat log, with the UPI demand and a look-alike domain.'

afterEach(() => {
  vi.clearAllMocks()
})

/**
 * The dialogs are rendered by parents that re-render while the user types (their own state, polling,
 * context updates) and pass a new inline onCancel each time - the situation that used to move focus.
 */
function RerenderingParent({ children }) {
  const [, setTick] = useState(0)
  useEffect(() => {
    const timer = setInterval(() => setTick((tick) => tick + 1), 20)
    return () => clearInterval(timer)
  }, [])
  return children(() => {})
}

describe('dialog text fields keep focus and every character while typing (regression)', () => {
  it('19a. ReopenDialog reason', async () => {
    const user = userEvent.setup()
    render(<RerenderingParent>{(onCancel) => <ReopenDialog onReopen={vi.fn()} onCancel={() => onCancel()} />}</RerenderingParent>)

    const field = screen.getByLabelText('Reason (staff only)')
    await user.type(field, LONG_REASON)

    expect(field).toHaveValue(LONG_REASON)
    expect(field).toHaveFocus()
  })

  it('19b. ConfirmDialog with an input owned by the parent (inline onCancel on every keystroke)', async () => {
    const user = userEvent.setup()
    function Parent() {
      const [text, setText] = useState('')
      return (
        <ConfirmDialog title="Suspend recruiter?" onConfirm={vi.fn()} onCancel={() => setText('')}>
          <TextField label="Reason" value={text} onChange={(event) => setText(event.target.value)} />
        </ConfirmDialog>
      )
    }
    render(<Parent />)

    const field = screen.getByLabelText('Reason')
    // The dialog focuses its text field when it opens.
    expect(field).toHaveFocus()
    await user.type(field, LONG_REASON)

    expect(field).toHaveValue(LONG_REASON)
    expect(field).toHaveFocus()
  })

  it('19c. advisory withdraw reason (the real page)', async () => {
    const user = userEvent.setup()
    getMe.mockResolvedValue({
      user: { id: 'h1', name: 'Ravi Head', email: 'head@alpha.demo.edu', role: 'tpo_head', collegeId: 'c1', status: 'active', mustChangePassword: false },
      college: { id: 'c1', name: 'Demo Alpha', code: 'demo-alpha', branches: ['COMP'] },
    })
    getStaffAdvisory.mockResolvedValue({
      id: 'a1',
      title: 'Fake registration-fee offers',
      body: 'Do not pay registration fees to anyone claiming to hire for campus roles.',
      severity: 'critical',
      status: 'published',
      target: { years: [], branches: [] },
      indicators: [],
      indicatorIds: [],
      acknowledgedCount: 1,
      audienceCount: 4,
      ackRate: 0.25,
      acknowledgementBreakdown: { byYear: [], byBranch: [] },
      needsReview: false,
    })
    withdrawAdvisory.mockResolvedValue({ id: 'a1', status: 'withdrawn', withdrawReason: LONG_REASON, title: 'x', body: 'y', severity: 'critical', indicators: [], target: { years: [], branches: [] } })

    render(
      <MemoryRouter initialEntries={['/staff/advisories/a1']}>
        <App />
      </MemoryRouter>,
    )
    await user.click(await screen.findByRole('button', { name: 'Withdraw advisory' }))
    const field = screen.getByLabelText('Reason (staff only)')
    await user.type(field, LONG_REASON)

    expect(field).toHaveValue(LONG_REASON)
    expect(field).toHaveFocus()
    await user.click(screen.getByRole('button', { name: 'Withdraw' }))
    await waitFor(() => expect(withdrawAdvisory).toHaveBeenCalledWith('a1', LONG_REASON))
  })

  it('19d. Escape still cancels, using the latest onCancel', async () => {
    const user = userEvent.setup()
    const onCancel = vi.fn()
    function Parent() {
      const [text, setText] = useState('')
      return (
        <ConfirmDialog title="Reject?" onConfirm={vi.fn()} onCancel={() => onCancel(text)}>
          <TextAreaField label="Why" value={text} onChange={(event) => setText(event.target.value)} />
        </ConfirmDialog>
      )
    }
    render(<Parent />)

    await user.type(screen.getByLabelText('Why'), 'abc')
    await act(async () => {
      await user.keyboard('{Escape}')
    })

    expect(onCancel).toHaveBeenCalledWith('abc')
  })

  it('a dialog without text fields focuses Cancel', () => {
    render(<ConfirmDialog title="Record decision?" onConfirm={vi.fn()} onCancel={vi.fn()} />)
    expect(screen.getByRole('button', { name: 'Cancel' })).toHaveFocus()
  })
})
