import { render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import HealthStatus from '../components/HealthStatus.jsx'
import { getHealth } from '../api/health.js'

vi.mock('../api/health.js', () => ({ getHealth: vi.fn() }))

afterEach(() => {
  vi.resetAllMocks()
})

describe('HealthStatus', () => {
  it('shows a loading state first', () => {
    getHealth.mockReturnValue(new Promise(() => {}))

    render(<HealthStatus />)

    expect(screen.getByText(/checking api status/i)).toBeInTheDocument()
  })

  it('shows the healthy state with version and environment when the API resolves', async () => {
    getHealth.mockResolvedValue({ status: 'ok', version: '0.1.0', environment: 'development' })

    render(<HealthStatus />)

    expect(await screen.findByText(/api is healthy/i)).toHaveTextContent('0.1.0')
    expect(screen.getByText(/api is healthy/i)).toHaveTextContent('development')
    expect(screen.queryByText(/checking api status/i)).not.toBeInTheDocument()
  })

  it('shows a friendly unavailable state when the API rejects', async () => {
    getHealth.mockRejectedValue(new Error('Network Error: ECONNREFUSED 127.0.0.1:5000'))

    render(<HealthStatus />)

    expect(await screen.findByText(/api is currently unavailable/i)).toBeInTheDocument()
    expect(screen.queryByText(/ECONNREFUSED/)).not.toBeInTheDocument()
  })
})
