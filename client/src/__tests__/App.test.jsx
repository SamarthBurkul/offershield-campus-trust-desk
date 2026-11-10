import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import App from '../App.jsx'

vi.mock('../api/health.js', () => ({
  getHealth: vi.fn(() => new Promise(() => {})),
}))

function renderAt(path) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <App />
    </MemoryRouter>,
  )
}

describe('App', () => {
  it('renders the header text and home page at /', () => {
    renderAt('/')

    expect(screen.getByText('OfferShield — Campus Trust Desk')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /trust & verification desk/i })).toBeInTheDocument()
  })

  it('renders the not-found page for an unknown path', () => {
    renderAt('/some/unknown/path')

    expect(screen.getByRole('heading', { name: /page not found/i })).toBeInTheDocument()
    expect(screen.getByText('OfferShield — Campus Trust Desk')).toBeInTheDocument()
  })
})
