import { useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { homePathForRole } from '../auth/roles.js'
import { useAuth } from '../auth/useAuth.js'
import { Hourglass, LogOut, RefreshCw } from 'lucide-react'
import { Alert, Button, Card } from '../components/ui/index.js'
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
    <div className="mx-auto max-w-xl space-y-6 py-4">
      <div className="flex flex-col items-center text-center">
        <span className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-50 text-amber-600 ring-1 ring-inset ring-amber-200" aria-hidden="true">
          <Hourglass className="h-7 w-7" />
        </span>
        <h1 className="mt-5 text-2xl font-semibold tracking-tight text-slate-900">Waiting for your placement cell to approve your account</h1>
      </div>
      <Card>
        <p className="text-slate-700">
          Your account{college ? ` at ${college.name}` : ''} was created. Because your college does not issue student email
          addresses, a placement officer checks each registration before you can use OfferShield.
        </p>
        <p className="text-slate-700">
          This usually happens within a working day. If it takes longer, ask your placement cell to approve
          <span className="font-medium"> {user.email}</span>.
        </p>
        {stillPending && <Alert variant="warning">Not approved yet. Please check again later.</Alert>}
        <div className="flex flex-wrap gap-3">
          <Button icon={RefreshCw} loading={checking} onClick={checkAgain}>
            {checking ? 'Checking…' : 'Check again'}
          </Button>
          <Button variant="secondary" icon={LogOut} onClick={handleLogout}>
            Log out
          </Button>
        </div>
      </Card>
    </div>
  )
}
