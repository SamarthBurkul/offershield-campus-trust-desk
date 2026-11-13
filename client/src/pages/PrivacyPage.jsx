import { Link } from 'react-router-dom'
import LegalLayout, { LegalSection } from '../components/LegalLayout.jsx'
import usePageTitle from '../hooks/usePageTitle.js'
import usePolicies from '../hooks/usePolicies.js'

const SECTIONS = ['What we collect and why','What we do not collect','Who can see what','Evidence handling and retention','Outcomes are findings, not guarantees','Corrections and deletion']

export default function PrivacyPage() {
  usePageTitle('Privacy notice')
  const { version, retentionMonths, supportEmail } = usePolicies()

  return (
    <LegalLayout title="Privacy notice" version={version} sections={SECTIONS}>

      <p>
        OfferShield is a verification desk your college&apos;s placement cell uses to check suspicious job and internship offers.
        This notice explains what it stores, why, and who can see it.
      </p>

      <LegalSection title="What we collect and why">
        <ul>
          <li>
            <strong>Your account:</strong> name, email, college, year and branch, a hashed password (never the password itself),
            account status, the time you accepted this notice, and your last sign-in time. Used to sign you in and to send
            advisories to the right batches.
          </li>
          <li>
            <strong>Verification requests you submit:</strong> the claimed company and role, how and when the offer reached you,
            the message text, links, the sender&apos;s contact details (email, phone, UPI ID), whether money was asked for or paid,
            whether you shared documents, your note, your replies, and the evidence files you upload. Used by placement staff to
            investigate the offer.
          </li>
          <li>
            <strong>Evidence files:</strong> PNG, JPEG or PDF, up to 3 MB each. Location and camera details are removed from images
            before they are stored.
          </li>
          <li>
            <strong>Lookups (&ldquo;check before you pay&rdquo;):</strong> only the kind of query (for example &ldquo;UPI ID&rdquo;) and
            the result category are recorded, never the text you searched for.
          </li>
          <li>
            <strong>Activity records:</strong> in-app notifications, advisory acknowledgements (with your year and branch), an audit
            log of staff actions, and server logs with the page address (without search terms), response status, timing and
            account id. Your IP address is used for rate limiting and is recorded in audit entries for security.
          </li>
        </ul>
      </LegalSection>

      <LegalSection title="What we do not collect">
        <p>
          OfferShield never asks for your Aadhaar number, PAN, bank account or card numbers, or OTPs, and the request form blocks
          Aadhaar- and PAN-like numbers. Please do not upload copies of identity documents. There is no location tracking, no
          advertising or analytics cookies, and no email or SMS is sent: the only cookie is your sign-in session.
        </p>
      </LegalSection>

      <LegalSection title="Who can see what">
        <ul>
          <li>
            <strong>You:</strong> your own requests, the updates and messages the placement cell shares with you, advisories for
            your batch, and your notifications.
          </li>
          <li>
            <strong>Placement staff of your college</strong> (placement officers and the TPO head): requests from your college,
            including evidence and their internal notes. Only the TPO head records final decisions and reads the audit log.
          </li>
          <li>
            <strong>The platform administrator</strong> sets up colleges and TPO head accounts. They cannot open requests, messages
            or evidence.
          </li>
          <li>
            <strong>Other colleges</strong> never see your college&apos;s data. When an offer is confirmed as fraud, its scam
            contacts (for example a UPI ID or a fake domain) are added to your college&apos;s registry and may appear in advisories,
            but never with your name or email.
          </li>
        </ul>
      </LegalSection>

      <LegalSection title="Evidence handling and retention">
        <p>
          Evidence is stored in the service&apos;s database and opened only through short-lived links by you or your
          college&apos;s placement staff. Evidence files are deleted {retentionMonths} months after a request is closed. The written
          record of the request and its decision is kept so the placement cell can show what it decided and why.
        </p>
      </LegalSection>

      <LegalSection title="Outcomes are findings, not guarantees">
        <p>
          Every outcome is your placement cell&apos;s finding based on the checks it made. OfferShield never certifies an offer as
          safe. Even when an offer is verified, never pay to apply, interview or join, and never share OTPs.
        </p>
      </LegalSection>

      <LegalSection title="Corrections and deletion">
        <p>
          To correct your details or ask for your account and requests to be deleted, contact your placement cell
          {supportEmail ? (
            <>
              {' '}or write to <a href={`mailto:${supportEmail}`}>{supportEmail}</a>
            </>
          ) : null}
          . Some records (such as confirmed fraud findings without your identity, and audit entries) may be kept where the college
          needs them to protect other students.
        </p>
      </LegalSection>

      <p>
        See also the <Link to="/terms">terms of use</Link>.
      </p>
    </LegalLayout>
  )
}
