import { Link, useNavigate } from 'react-router-dom'
import { VERIFICATION_METHOD_LABELS } from '../constants/verificationMethods.js'
import { Button } from './ui.jsx'

const STYLES = {
  confirmed_fraud: 'border-red-300 bg-red-50 text-red-900',
  lookalike_warning: 'border-amber-300 bg-amber-50 text-amber-900',
  verified: 'border-emerald-300 bg-emerald-50 text-emerald-900',
  verified_expired: 'border-slate-300 bg-slate-100 text-slate-700',
  not_reviewed: 'border-slate-200 bg-white text-slate-800',
}

const TITLES = {
  confirmed_fraud: 'Confirmed fraud',
  lookalike_warning: 'Look-alike warning',
  verified: 'Verified by your placement cell',
  verified_expired: 'Verification expired',
  not_reviewed: 'Not reviewed',
}

const day = (iso) => (iso ? new Date(iso).toLocaleDateString() : 'an unknown date')

function message(result) {
  const recruiter = result.verifiedRecruiters?.find((item) => !item.isExpired) ?? result.verifiedRecruiters?.[0]
  switch (result.resultStatus) {
    case 'confirmed_fraud':
      return `Your placement cell confirmed this was used in a fraudulent offer on ${day(result.fraudMatches?.[0]?.confirmedAt)}. Do not pay or share documents. If you already paid, call 1930 or report at cybercrime.gov.in.`
    case 'lookalike_warning': {
      const target = result.lookalikeOf?.[0]
      return `This looks similar to ${target?.domain} (${target?.companyName}), which your placement cell verified, but it is a different address. Treat it as suspicious and ask your placement cell.`
    }
    case 'verified':
      return `${recruiter.companyName} was verified by your placement cell on ${day(recruiter.verifiedAt)} using: ${recruiter.methods
        .map((method) => VERIFICATION_METHOD_LABELS[method] ?? method)
        .join(', ')}. Valid until ${day(recruiter.expiresAt)}. Genuine recruiters never charge fees — make sure messages come only from: ${recruiter.domains.join(', ')}.`
    case 'verified_expired':
      return `Verification expired on ${day(recruiter?.expiresAt)}.`
    default:
      return 'Your placement cell has not reviewed this yet. Not reviewed does not mean safe.'
  }
}

/** Query params that pre-fill the new request form with what was looked up. */
function prefillParams(query, queryType) {
  const params = new URLSearchParams()
  if (queryType === 'company') params.set('company', query)
  else if (queryType === 'email') params.set('email', query)
  else if (queryType === 'phone') params.set('phone', query)
  else if (queryType === 'upi') params.set('upi', query)
  else if (queryType === 'url') params.set('link', query)
  else if (queryType === 'domain') params.set('link', `https://${query}`)
  return params.toString()
}

/**
 * One lookup result. Students get an "Ask your placement cell to verify" button; staff see source case
 * links on fraud matches (the server only sends those to staff).
 */
export default function LookupResultCard({ result, query, showAskButton = true }) {
  const navigate = useNavigate()
  const sourceCases = (result.fraudMatches ?? []).flatMap((match) => match.sourceCases ?? [])

  return (
    <section
      role="status"
      aria-label="Lookup result"
      data-status={result.resultStatus}
      className={`space-y-3 rounded-lg border p-4 ${STYLES[result.resultStatus] ?? STYLES.not_reviewed}`}
    >
      <h3 className="font-semibold">{TITLES[result.resultStatus] ?? 'Result'}</h3>
      <p className="text-sm">{message(result)}</p>
      {sourceCases.length > 0 && (
        <p className="text-sm">
          Source cases (staff only):{' '}
          {sourceCases.map((item, index) => (
            <span key={item.id}>
              {index > 0 && ', '}
              <Link to={`/staff/cases/${item.id}`} className="font-mono font-medium underline">
                {item.caseNumber ?? item.id}
              </Link>
            </span>
          ))}
        </p>
      )}
      {showAskButton && (
        <Button variant="secondary" onClick={() => navigate(`/student/requests/new?${prefillParams(query, result.queryType)}`)}>
          Ask your placement cell to verify
        </Button>
      )}
    </section>
  )
}
