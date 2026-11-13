import { ArrowRight, FilePlus2, FileSearch, Megaphone } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { listAdvisories } from '../api/advisories.js'
import { listMyCases } from '../api/cases.js'
import { useAuth } from '../auth/useAuth.js'
import AdvisoryBanner from '../components/AdvisoryBanner.jsx'
import LookupBox from '../components/LookupBox.jsx'
import StatusBadge from '../components/StatusBadge.jsx'
import { Card } from '../components/ui/index.js'
import usePageTitle from '../hooks/usePageTitle.js'
import { formatDateTime, relativeTime } from '../utils/format.js'

const STEPS = [
  "Search your college's registry of reviewed recruiters and confirmed suspicious indicators.",
  'If an offer still looks suspicious, submit a verification request with your evidence.',
  'Your placement cell investigates it as a case and may ask you for more information.',
  'The TPO head records the final decision with reasons, and you are told the outcome.',
  'Confirmed findings are added to the registry and advisories warn other students.',
]

const ACTIONS = [
  {
    to: '/student/requests/new',
    icon: FilePlus2,
    title: 'Ask your placement cell to verify an offer',
    body: 'Share the message, contacts and screenshots of a job or internship offer that looks suspicious.',
  },
  { to: '/student/requests', icon: FileSearch, title: 'My requests', body: 'Track your requests, reply to your placement cell and add more evidence.' },
  { to: '/advisories', icon: Megaphone, title: 'Advisories', body: 'Warnings your placement cell published about scams aimed at students.' },
]

function RecentRequests() {
  const [cases, setCases] = useState(null)

  useEffect(() => {
    let active = true
    Promise.resolve()
      .then(() => listMyCases({ limit: 3 }))
      .then((data) => active && setCases(data?.cases ?? []))
      .catch(() => active && setCases([]))
    return () => {
      active = false
    }
  }, [])

  if (!cases?.length) return null
  return (
    <Card
      title="Your recent requests"
      actions={
        <Link to="/student/requests" className="inline-flex items-center gap-1 text-sm font-medium text-accent-700 hover:text-accent-800">
          View all <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
        </Link>
      }
      padded={false}
    >
      <ul className="divide-y divide-slate-100">
        {cases.slice(0, 3).map((item) => (
          <li key={item.id}>
            <Link to={`/student/requests/${item.id}`} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5 transition hover:bg-slate-50">
              <span className="min-w-0">
                <span className="block truncate font-medium text-slate-900">{item.claimedCompany}</span>
                <span className="block text-xs text-slate-500">
                  <span className="font-mono">{item.caseNumber}</span> ·{' '}
                  <time dateTime={item.createdAt} title={formatDateTime(item.createdAt)}>
                    {relativeTime(item.createdAt)}
                  </time>
                </span>
              </span>
              <StatusBadge status={item.status} />
            </Link>
          </li>
        ))}
      </ul>
    </Card>
  )
}

export default function StudentHomePage() {
  usePageTitle('Home')
  const { user, college } = useAuth()
  const [advisories, setAdvisories] = useState([])

  useEffect(() => {
    let active = true
    listAdvisories()
      .then((items) => active && setAdvisories(items))
      .catch(() => active && setAdvisories([]))
    return () => {
      active = false
    }
  }, [])

  return (
    <div className="space-y-8">
      <AdvisoryBanner
        advisories={advisories}
        onAcknowledged={(id) => setAdvisories((items) => items.map((item) => (item.id === id ? { ...item, acknowledged: true } : item)))}
      />

      <section className="hero-band relative overflow-hidden rounded-3xl px-5 py-8 text-white shadow-overlay sm:px-10 sm:py-10">
        <div className="max-w-3xl space-y-1">
          <p className="text-sm font-medium text-brand-200">{college?.name}</p>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Welcome, {user.name}</h1>
          <p className="pt-1 text-[15px] text-brand-100">Check before you pay: look up anything a recruiter sent you.</p>
        </div>
        <div className="mt-6 max-w-3xl">
          <LookupBox variant="hero" />
        </div>
      </section>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {ACTIONS.map((action) => (
          <Link
            key={action.to}
            to={action.to}
            className="group rounded-2xl bg-white p-5 shadow-card ring-1 ring-slate-900/5 transition duration-150 hover:-translate-y-0.5 hover:shadow-raised"
          >
            <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-accent-50 text-accent-700" aria-hidden="true">
              <action.icon className="h-5 w-5" />
            </span>
            <h2 className="mt-4 font-semibold text-slate-900 group-hover:text-accent-800">{action.title}</h2>
            <p className="mt-1 text-sm leading-6 text-slate-600">{action.body}</p>
          </Link>
        ))}
      </div>

      <RecentRequests />

      <p className="text-sm text-slate-600">
        Your placement cell reviews every request. Automated checks only highlight details for them; they never decide
        whether an offer is genuine.
      </p>

      <Card title="How OfferShield works">
        <ol className="space-y-3">
          {STEPS.map((step, index) => (
            <li key={step} className="flex gap-3 text-slate-700">
              <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-50 text-xs font-semibold text-brand-700" aria-hidden="true">
                {index + 1}
              </span>
              {step}
            </li>
          ))}
        </ol>
      </Card>
    </div>
  )
}
