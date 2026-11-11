import { Link } from 'react-router-dom'
import { useAuth } from '../auth/useAuth.js'
import LookupBox from '../components/LookupBox.jsx'
import { Card } from '../components/ui.jsx'

const STEPS = [
  "Search your college's registry of reviewed recruiters and confirmed suspicious indicators.",
  'If an offer still looks suspicious, submit a verification request with your evidence.',
  'Your placement cell investigates it as a case and may ask you for more information.',
  'The TPO head records the final decision with reasons, and you are told the outcome.',
  'Confirmed findings are added to the registry and advisories warn other students.',
]

function ActionCard({ to, title, children }) {
  return (
    <Link
      to={to}
      className="block rounded-lg border border-slate-200 bg-white p-5 shadow-sm transition hover:border-blue-300 hover:shadow"
    >
      <h2 className="text-lg font-semibold text-blue-900">{title}</h2>
      <p className="mt-1 text-sm text-slate-600">{children}</p>
    </Link>
  )
}

export default function StudentHomePage() {
  const { user, college } = useAuth()
  return (
    <div className="space-y-6">
      <section className="space-y-1">
        <h1 className="text-2xl font-bold text-slate-900">Welcome, {user.name}</h1>
        {college && <p className="text-slate-600">{college.name}</p>}
      </section>

      <LookupBox />

      <div className="grid gap-4 sm:grid-cols-2">
        <ActionCard to="/student/requests/new" title="Ask your placement cell to verify an offer">
          Share the message, contacts and screenshots of a job or internship offer that looks suspicious.
        </ActionCard>
        <ActionCard to="/student/requests" title="My requests">
          Track your requests, reply to your placement cell and add more evidence.
        </ActionCard>
      </div>
      <p className="text-sm text-slate-600">
        Your placement cell reviews every request. Automated checks only highlight details for them; they never decide
        whether an offer is genuine.
      </p>

      <Card title="How OfferShield works">
        <ol className="list-decimal space-y-2 pl-5 text-slate-700">
          {STEPS.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ol>
      </Card>
    </div>
  )
}
