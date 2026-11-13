import {
  ArrowRight,
  BellRing,
  Building2,
  ClipboardCheck,
  EyeOff,
  FileSearch,
  GraduationCap,
  Lock,
  Search,
  ShieldCheck,
  ShieldOff,
} from 'lucide-react'
import { Link, Navigate } from 'react-router-dom'
import { homePathForRole } from '../auth/roles.js'
import { useAuth } from '../auth/useAuth.js'
import LookupResultCard from '../components/LookupResultCard.jsx'
import { ButtonLink, buttonClasses } from '../components/ui/index.js'
import usePageTitle from '../hooks/usePageTitle.js'

// Static, clearly fictional samples rendered with the real result component (".example" is a reserved domain).
const SAMPLES = [
  {
    resultStatus: 'verified',
    queryType: 'domain',
    verifiedRecruiters: [
      {
        companyName: 'Northwind Systems',
        domains: ['northwind.example'],
        methods: ['called_official_number', 'checked_official_careers_page'],
        verifiedAt: '2026-08-04T00:00:00.000Z',
        expiresAt: '2027-08-04T00:00:00.000Z',
        isExpired: false,
      },
    ],
  },
  { resultStatus: 'lookalike_warning', queryType: 'domain', lookalikeOf: [{ domain: 'northwind.example', companyName: 'Northwind Systems' }] },
  { resultStatus: 'confirmed_fraud', queryType: 'upi', fraudMatches: [{ type: 'upi', value: 'hr.fees.demo@okaxis', confirmedAt: '2026-10-21T00:00:00.000Z' }] },
]

const STEPS = [
  {
    icon: Search,
    title: 'Check before you pay',
    body: 'Look up a company, website, email, phone number or UPI ID against what your placement cell has verified or confirmed as fraud.',
  },
  {
    icon: FileSearch,
    title: 'Ask your placement cell',
    body: 'Send a suspicious offer with screenshots. Your placement cell investigates it and tells you what they found.',
  },
  {
    icon: BellRing,
    title: 'Confirmed findings protect everyone',
    body: 'When a scam is confirmed, its contacts are flagged for every student and targeted advisories warn the batches at risk.',
  },
]

const AUDIENCES = [
  {
    icon: GraduationCap,
    title: 'For students',
    points: [
      'Check any recruiter contact in seconds, before paying or sharing documents.',
      'Ask for a verification with the message and screenshots; reply when staff have questions.',
      'Read targeted advisories about scams aimed at your batch.',
    ],
  },
  {
    icon: Building2,
    title: 'For placement cells',
    points: [
      'A case desk with priorities, related cases and automated hints — staff stay in charge.',
      'TPO-head decisions with recorded checks, an append-only audit log and reopen with history.',
      'A registry of verified recruiters and confirmed scam contacts, plus advisories and statistics.',
    ],
  },
]

const PRINCIPLES = [
  { icon: ClipboardCheck, title: 'Findings only come from placement-cell decisions', body: 'Automated checks only highlight details. A contact is marked as fraud only after the TPO head records a decision with reasons.' },
  { icon: ShieldOff, title: 'It never certifies an offer as safe', body: '"Verified" means your placement cell checked that recruiter. "Not reviewed" does not mean safe. Never pay to apply, train or join.' },
  { icon: Lock, title: 'Evidence stays private', body: 'Screenshots are visible only to you and your college’s placement staff, opened through short-lived links. Location data is removed from images.' },
  { icon: EyeOff, title: 'Every college is isolated', body: 'Each college’s requests, registry and advisories are separate. Other colleges — and the platform administrator — cannot read your cases.' },
]

const FAQ = [
  {
    q: 'Is OfferShield an AI scam detector?',
    a: 'No. It highlights warning signs for your placement cell, but people decide. Only a TPO-head decision can mark something as confirmed fraud.',
  },
  {
    q: 'Who can see my request?',
    a: 'You and your college’s placement officers and TPO head. The platform administrator manages colleges but cannot open requests or evidence.',
  },
  {
    q: 'Does a green result mean the offer is safe?',
    a: 'No. It means your placement cell verified that recruiter’s official contacts. Scammers copy real company names, so check the sender’s address and never pay any fee.',
  },
  {
    q: 'What if I already paid?',
    a: 'Report it at once on cybercrime.gov.in or by calling 1930, keep your screenshots, and tell your placement cell through a verification request.',
  },
  {
    q: 'My college does not give students an email address.',
    a: 'Register with your personal email, the college code and the join code. Your placement cell approves your account before you can use the desk.',
  },
]

/** Public landing page. Signed-in users go straight to their home page. */
export default function LandingPage() {
  usePageTitle(null)
  const { user, loading } = useAuth()
  if (!loading && user) return <Navigate to={homePathForRole(user.role)} replace />

  return (
    <div>
      <section className="hero-band overflow-hidden text-white">
        <div className="mx-auto grid max-w-6xl grid-cols-1 items-center gap-12 px-4 py-16 sm:px-6 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)] lg:py-24">
          <div className="space-y-7">
            <h1 className="space-y-4">
              <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-accent-100 ring-1 ring-inset ring-white/15">
                <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
                Campus Recruitment Trust &amp; Verification Desk
              </span>
              <span className="block text-4xl font-semibold leading-[1.1] tracking-tight sm:text-5xl">Check before you pay. Ask before you share.</span>
            </h1>
            <p className="max-w-xl text-lg leading-8 text-brand-100">
              OfferShield helps students and placement cells stop fake job and internship offers before anyone pays — with a
              college registry, a verification desk and targeted advisories.
            </p>
            <div className="flex flex-wrap gap-3">
              <ButtonLink to="/login" size="lg" iconRight={ArrowRight}>
                Log in
              </ButtonLink>
              <Link to="/register" className={buttonClasses({ variant: 'secondary', size: 'lg', className: 'bg-white/10! text-white! ring-white/25! hover:bg-white/15! hover:ring-white/40!' })}>
                Register as a student
              </Link>
            </div>
          </div>
          <div aria-label="Example lookup results" role="group" className="relative mx-auto w-full max-w-lg">
            {SAMPLES.map((sample, index) => (
              <div
                key={sample.resultStatus}
                className="relative rounded-2xl bg-white/95 shadow-overlay ring-1 ring-white/20 transition duration-200 hover:-translate-y-1"
                style={{ marginLeft: `${index * 6}%`, marginTop: index === 0 ? 0 : '-0.75rem', zIndex: index + 1 }}
              >
                <LookupResultCard result={sample} preview showAskButton={false} />
              </div>
            ))}
            <p className="mt-4 text-center text-xs text-brand-200">Sample results with fictional contacts.</p>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6" aria-labelledby="how-heading">
        <p className="text-sm font-semibold uppercase tracking-wider text-accent-700">How it works</p>
        <h2 id="how-heading" className="mt-2 text-3xl font-semibold tracking-tight text-slate-900">
          From a suspicious message to a campus-wide warning
        </h2>
        <ol className="mt-10 grid grid-cols-1 gap-6 md:grid-cols-3">
          {STEPS.map((step, index) => (
            <li key={step.title} className="relative rounded-2xl bg-white p-6 shadow-card ring-1 ring-slate-900/5">
              <span className="absolute right-5 top-5 text-sm font-semibold text-slate-300 tabular-nums" aria-hidden="true">
                0{index + 1}
              </span>
              <span className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-accent-50 text-accent-700" aria-hidden="true">
                <step.icon className="h-5 w-5" />
              </span>
              <h3 className="mt-4 text-lg font-semibold tracking-tight text-slate-900">{step.title}</h3>
              <p className="mt-2 text-sm leading-6 text-slate-600">{step.body}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="border-y border-slate-200 bg-white">
        <div className="mx-auto grid max-w-6xl grid-cols-1 gap-6 px-4 py-16 sm:px-6 md:grid-cols-2">
          {AUDIENCES.map((audience) => (
            <div key={audience.title} className="rounded-2xl bg-slate-50 p-7 ring-1 ring-inset ring-slate-200">
              <div className="flex items-center gap-3">
                <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-brand-900 text-white" aria-hidden="true">
                  <audience.icon className="h-5 w-5" />
                </span>
                <h2 className="text-xl font-semibold tracking-tight text-slate-900">{audience.title}</h2>
              </div>
              <ul className="mt-5 space-y-3">
                {audience.points.map((point) => (
                  <li key={point} className="flex gap-3 text-[15px] leading-6 text-slate-700">
                    <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-accent-600" aria-hidden="true" />
                    {point}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6" aria-labelledby="principles-heading">
        <p className="text-sm font-semibold uppercase tracking-wider text-accent-700">Trust principles</p>
        <h2 id="principles-heading" className="mt-2 text-3xl font-semibold tracking-tight text-slate-900">
          Built to be careful with students and with findings
        </h2>
        <ul className="mt-10 grid grid-cols-1 gap-5 sm:grid-cols-2" aria-label="Trust principles">
          {PRINCIPLES.map((principle) => (
            <li key={principle.title} className="flex gap-4 rounded-2xl bg-white p-6 shadow-card ring-1 ring-slate-900/5">
              <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-700" aria-hidden="true">
                <principle.icon className="h-5 w-5" />
              </span>
              <div>
                <h3 className="font-semibold text-slate-900">{principle.title}</h3>
                <p className="mt-1 text-sm leading-6 text-slate-600">{principle.body}</p>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section className="border-t border-slate-200 bg-white" aria-labelledby="faq-heading">
        <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
          <h2 id="faq-heading" className="text-3xl font-semibold tracking-tight text-slate-900">
            Questions students ask
          </h2>
          <div className="mt-8 divide-y divide-slate-200 rounded-2xl ring-1 ring-slate-200">
            {FAQ.map((item) => (
              <details key={item.q} className="group px-5 py-4">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-medium text-slate-900">
                  {item.q}
                  <span className="text-xl leading-none text-slate-400 transition group-open:rotate-45" aria-hidden="true">
                    +
                  </span>
                </summary>
                <p className="mt-3 text-[15px] leading-7 text-slate-600">{item.a}</p>
              </details>
            ))}
          </div>
          <p className="mt-6 text-sm text-slate-600">
            Read the{' '}
            <Link to="/privacy" className="font-medium text-accent-700 underline underline-offset-2">
              privacy notice
            </Link>{' '}
            and the{' '}
            <Link to="/terms" className="font-medium text-accent-700 underline underline-offset-2">
              terms of use
            </Link>
            .
          </p>
        </div>
      </section>
    </div>
  )
}
