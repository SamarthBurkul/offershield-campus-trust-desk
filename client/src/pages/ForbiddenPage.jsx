import { ArrowLeft, ShieldX } from 'lucide-react'
import { homePathForRole } from '../auth/roles.js'
import { useAuth } from '../auth/useAuth.js'
import { ButtonLink, EmptyState } from '../components/ui/index.js'

export default function ForbiddenPage() {
  const { user } = useAuth()
  return (
    <div className="mx-auto max-w-xl py-10">
      <EmptyState
        icon={ShieldX}
        as="h1"
        title="Access denied"
        action={
          <ButtonLink to={homePathForRole(user?.role)} variant="secondary" icon={ArrowLeft}>
            Go to your home page
          </ButtonLink>
        }
      >
        Your account does not have permission to view this page.
      </EmptyState>
    </div>
  )
}
