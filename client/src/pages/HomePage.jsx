import HealthStatus from '../components/HealthStatus.jsx'

export default function HomePage() {
  return (
    <div className="space-y-8">
      <section className="space-y-3">
        <h1 className="text-2xl font-bold text-slate-900">Campus Recruitment Trust &amp; Verification Desk</h1>
        <p className="leading-relaxed text-slate-600">
          OfferShield lets students check their college&apos;s reviewed recruiter records and confirmed
          suspicious indicators, and submit verification requests with evidence when an external job or
          internship offer looks suspicious. Placement staff investigate each request as a case, the TPO head
          records the final decision with reasons, confirmed findings are added to the college registry, and
          the TPO publishes advisories to the students who need them.
        </p>
      </section>

      <HealthStatus />
    </div>
  )
}
