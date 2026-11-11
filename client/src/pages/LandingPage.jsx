import { Link, Navigate } from 'react-router-dom'
import { homePathForRole } from '../auth/roles.js'
import { useAuth } from '../auth/useAuth.js'
import usePageTitle from '../hooks/usePageTitle.js'

const SECTIONS = [
  {
    title: 'Check before you pay',
    body: 'Look up a company, website, email, phone number or UPI ID against what your placement cell has verified or confirmed as fraud.',
  },
  {
    title: 'Ask your placement cell',
    body: 'Send a suspicious offer with screenshots. Your placement cell investigates it and tells you what they found.',
  },
  {
    title: 'Confirmed findings protect everyone',
    body: 'When a scam is confirmed, its contacts are flagged for every student and targeted advisories warn the batches at risk.',
  },
]

/** Public landing page. Signed-in users go straight to their home page. */
export default function LandingPage() {
  usePageTitle(null)
  const { user, loading } = useAuth()
  if (!loading && user) return <Navigate to={homePathForRole(user.role)} replace />

  return (
    <div className="space-y-10">
      <section className="space-y-4 text-center sm:text-left">
        <h1 className="text-3xl font-bold text-slate-900">Campus Recruitment Trust &amp; Verification Desk</h1>
        <p className="max-w-2xl text-lg text-slate-600">
          OfferShield helps students and placement cells stop fake job and internship offers before anyone pays.
        </p>
        <div className="flex flex-wrap justify-center gap-3 sm:justify-start">
          <Link to="/login" className="rounded-md bg-blue-700 px-5 py-2.5 font-medium text-white shadow-sm hover:bg-blue-800">
            Log in
          </Link>
          <Link to="/register" className="rounded-md border border-slate-300 bg-white px-5 py-2.5 font-medium text-slate-800 hover:bg-slate-50">
            Register as a student
          </Link>
        </div>
      </section>
      <div className="grid gap-4 md:grid-cols-3">
        {SECTIONS.map((section) => (
          <section key={section.title} className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-semibold text-blue-900">{section.title}</h2>
            <p className="mt-2 text-sm text-slate-600">{section.body}</p>
          </section>
        ))}
      </div>
    </div>
  )
}
