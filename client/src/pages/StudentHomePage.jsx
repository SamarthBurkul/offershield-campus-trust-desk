import { useAuth } from '../auth/useAuth.js'
import { Card } from '../components/ui.jsx'

const STEPS = [
  "Search your college's registry of reviewed recruiters and confirmed suspicious indicators.",
  'If an offer still looks suspicious, submit a verification request with your evidence.',
  'Your placement cell investigates it as a case and may ask you for more information.',
  'The TPO head records the final decision with reasons, and you are told the outcome.',
  'Confirmed findings are added to the registry and advisories warn other students.',
]

export default function StudentHomePage() {
  const { user, college } = useAuth()
  return (
    <div className="space-y-6">
      <section className="space-y-1">
        <h1 className="text-2xl font-bold text-slate-900">Welcome, {user.name}</h1>
        {college && <p className="text-slate-600">{college.name}</p>}
      </section>
      <Card title="How OfferShield works">
        <ol className="list-decimal space-y-2 pl-5 text-slate-700">
          {STEPS.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ol>
        <p className="text-sm text-slate-500">
          Automated checks only assist your placement staff; they never decide whether an offer is genuine.
          Registry search and verification requests arrive in upcoming releases.
        </p>
      </Card>
    </div>
  )
}
