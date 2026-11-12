import { useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { homePathForRole } from '../auth/roles.js'
import { useAuth } from '../auth/useAuth.js'
import { Button, Card } from '../components/ui.jsx'
import usePageTitle from '../hooks/usePageTitle.js'

/** Shown to students of a manual-approval college until a placement officer or the TPO head approves them. */
export default function PendingApprovalPage() {
  usePageTitle('Waiting for approval')
  const { user, college, refresh, logout } = useAuth()
  const navigate = useNavigate()
  const [checking, setChecking] = useState(false)
  const [stillPending, setStillPending] = useState(false)

  if (user.status !== 'pending_approval') return <Navigate to={homePathForRole(user.role)} replace />

  async function checkAgain() {
    setChecking(true)
    const current = await refresh()
    setChecking(false)
    if (current?.status === 'pending_approval') setStillPending(true)
  }

  async function handleLogout() {
    await logout()
    navigate('/login', { replace: true })
  }

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <h1 className="text-2xl font-bold text-slate-900">Waiting for your placement cell to approve your account</h1>
      <Card>
        <p className="text-slate-700">
          Your account{college ? ` at ${college.name}` : ''} was created. Because your college does not issue student email
          addresses, a placement officer checks each registration before you can use OfferShield.
        </p>
        <p className="text-slate-700">
          This usually happens within a working day. If it takes longer, ask your placement cell to approve
          <span className="font-medium"> {user.email}</span>.
        </p>
        {stillPending && <p className="text-sm text-slate-600">Not approved yet. Please check again later.</p>}
        <div className="flex flex-wrap gap-3">
          <Button onClick={checkAgain} disabled={checking}>
            {checking ? 'Checking…' : 'Check again'}
          </Button>
          <Button variant="secondary" onClick={handleLogout}>
            Log out
          </Button>
        </div>
      </Card>
    </div>
  )
}
