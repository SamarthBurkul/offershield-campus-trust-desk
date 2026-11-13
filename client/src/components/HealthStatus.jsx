import { useEffect, useState } from 'react'
import { getHealth } from '../api/health.js'

export default function HealthStatus() {
  const [state, setState] = useState({ status: 'loading', health: null })

  useEffect(() => {
    let active = true
    getHealth()
      .then((health) => {
        if (active) setState({ status: 'healthy', health })
      })
      .catch(() => {
        if (active) setState({ status: 'unavailable', health: null })
      })
    return () => {
      active = false
    }
  }, [])

  return (
    <section
      role="status"
      aria-live="polite"
      className="rounded-2xl bg-white p-4 shadow-card ring-1 ring-slate-900/5"
    >
      <h2 className="text-sm font-medium uppercase tracking-wide text-slate-500">API status</h2>

      {state.status === 'loading' && <p className="mt-2 text-slate-600">Checking API status…</p>}

      {state.status === 'healthy' && (
        <p className="mt-2 flex items-center gap-2 text-emerald-700">
          <span className="inline-block h-2.5 w-2.5 rounded-full bg-emerald-500 ring-4 ring-emerald-100" aria-hidden="true" />
          API is healthy — version {state.health.version} ({state.health.environment})
        </p>
      )}

      {state.status === 'unavailable' && (
        <p className="mt-2 flex items-center gap-2 text-amber-700">
          <span className="inline-block h-2.5 w-2.5 rounded-full bg-amber-500 ring-4 ring-amber-100" aria-hidden="true" />
          The API is currently unavailable. Please try again in a few minutes.
        </p>
      )}
    </section>
  )
}
