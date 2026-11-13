import { Link } from 'react-router-dom'
import LegalLayout, { LegalSection } from '../components/LegalLayout.jsx'
import usePageTitle from '../hooks/usePageTitle.js'
import usePolicies from '../hooks/usePolicies.js'

const SECTIONS = ['What OfferShield is','Outcomes','Your account','Fair use','Availability and changes']

export default function TermsPage() {
  usePageTitle('Terms of use')
  const { version } = usePolicies()

  return (
    <LegalLayout title="Terms of use" version={version} sections={SECTIONS}>

      <LegalSection title="What OfferShield is">
        <p>
          OfferShield is your college placement cell&apos;s desk for checking suspicious job and internship offers. It is not a job
          portal, does not detect scams automatically, and does not decide whether an offer is genuine: placement staff do.
        </p>
      </LegalSection>

      <LegalSection title="Outcomes">
        <p>
          An outcome is your placement cell&apos;s finding based on the checks it made, not a guarantee, legal advice or an
          endorsement of any employer. OfferShield never certifies an offer as safe. You remain responsible for your own decisions;
          never pay to apply, interview or join, and never share OTPs.
        </p>
      </LegalSection>

      <LegalSection title="Your account">
        <ul>
          <li>Your account is personal. Keep your password private and do not let others use your account.</li>
          <li>Register with accurate details. In colleges that approve students manually, staff may reject unknown registrations.</li>
          <li>Forgot your password? Ask your placement cell to reset it; they will give you a temporary password.</li>
        </ul>
      </LegalSection>

      <LegalSection title="Fair use">
        <ul>
          <li>Submit only offers or messages you actually received, and describe them honestly.</li>
          <li>Do not upload Aadhaar, PAN or other identity documents, bank details, or other people&apos;s personal information.</li>
          <li>Do not try to access other students&apos; requests, other colleges&apos; data, or to overload the service.</li>
          <li>Placement staff use what they see only to review requests and protect students.</li>
        </ul>
      </LegalSection>

      <LegalSection title="Availability and changes">
        <p>
          The service may be slow to start after a quiet period and may occasionally be unavailable. When these terms or the
          privacy notice change, the version above changes and your placement cell will tell you what is different.
        </p>
      </LegalSection>

      <p>
        How your data is handled is described in the <Link to="/privacy">privacy notice</Link>.
      </p>
    </LegalLayout>
  )
}
