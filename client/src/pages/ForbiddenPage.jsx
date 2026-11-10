import { Link } from 'react-router-dom'
import { homePathForRole } from '../auth/roles.js'
import { useAuth } from '../auth/useAuth.js'

export default function ForbiddenPage() {
  const { user } = useAuth()
  return (
    <section className="space-y-3 text-center">
      <h1 className="text-2xl font-bold text-slate-900">Access denied</h1>
      <p className="text-slate-600">Your account does not have permission to view this page.</p>
      <Link to={homePathForRole(user?.role)} className="inline-block font-medium text-blue-700 hover:underline">
        Go to your home page
      </Link>
    </section>
  )
}
