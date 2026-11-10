import { Link } from 'react-router-dom'
import { ROLE_LABELS, ROLES } from '../auth/roles.js'
import { useAuth } from '../auth/useAuth.js'
import { Card } from '../components/ui.jsx'

export default function StaffHomePage() {
  const { user, college } = useAuth()
  return (
    <div className="space-y-6">
      <section className="space-y-1">
        <h1 className="text-2xl font-bold text-slate-900">Welcome, {user.name}</h1>
        <p className="text-slate-600">
          {ROLE_LABELS[user.role]}
          {college ? ` · ${college.name}` : ''}
        </p>
      </section>
      <Card title="Staff desk">
        <p className="text-slate-700">
          The verification case desk opens in an upcoming release. For now you can review your college&apos;s staff
          {user.role === ROLES.TPO_HEAD ? ' and manage placement officer accounts' : ''}.
        </p>
        <Link to="/staff/members" className="inline-block font-medium text-blue-700 hover:underline">
          {user.role === ROLES.TPO_HEAD ? 'Manage staff members' : 'View staff members'}
        </Link>
      </Card>
    </div>
  )
}
