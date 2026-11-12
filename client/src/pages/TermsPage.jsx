import { Link } from 'react-router-dom'
import usePageTitle from '../hooks/usePageTitle.js'
import usePolicies from '../hooks/usePolicies.js'

function Section({ title, children }) {
  return (
    <section className="space-y-2">
      <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
      <div className="space-y-2 text-sm leading-6 text-slate-700">{children}</div>
    </section>
  )
}

export default function TermsPage() {
  usePageTitle('Terms of use')
  const { version } = usePolicies()

  return (
    <article className="mx-auto max-w-3xl space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-bold text-slate-900">Terms of use</h1>
        <p className="text-sm text-slate-500">Version {version}</p>
      </header>

      <Section title="What OfferShield is">
        <p>
          OfferShield is your college placement cell&apos;s desk for checking suspicious job and internship offers. It is not a job
          portal, does not detect scams automatically, and does not decide whether an offer is genuine: placement staff do.
        </p>
      </Section>

      <Section title="Outcomes">
        <p>
          An outcome is your placement cell&apos;s finding based on the checks it made, not a guarantee, legal advice or an
          endorsement of any employer. OfferShield never certifies an offer as safe. You remain responsible for your own decisions;
          never pay to apply, interview or join, and never share OTPs.
        </p>
      </Section>

      <Section title="Your account">
        <ul className="list-disc space-y-1 pl-5">
          <li>Your account is personal. Keep your password private and do not let others use your account.</li>
          <li>Register with accurate details. In colleges that approve students manually, staff may reject unknown registrations.</li>
          <li>Forgot your password? Ask your placement cell to reset it; they will give you a temporary password.</li>
        </ul>
      </Section>

      <Section title="Fair use">
        <ul className="list-disc space-y-1 pl-5">
          <li>Submit only offers or messages you actually received, and describe them honestly.</li>
          <li>Do not upload Aadhaar, PAN or other identity documents, bank details, or other people&apos;s personal information.</li>
          <li>Do not try to access other students&apos; requests, other colleges&apos; data, or to overload the service.</li>
          <li>Placement staff use what they see only to review requests and protect students.</li>
        </ul>
      </Section>

      <Section title="Availability and changes">
        <p>
          The service may be slow to start after a quiet period and may occasionally be unavailable. When these terms or the
          privacy notice change, the version above changes and your placement cell will tell you what is different.
        </p>
      </Section>

      <p className="text-sm text-slate-600">
        How your data is handled is described in the <Link to="/privacy" className="font-medium text-blue-700 hover:underline">privacy notice</Link>.
      </p>
    </article>
  )
}
