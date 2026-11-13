import clsx from 'clsx'
import { AlertTriangle, ArrowRight, BadgeCheck, CircleHelp, Clock3, ShieldAlert } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import { VERIFICATION_METHOD_LABELS } from '../constants/verificationMethods.js'
import { formatDate } from '../utils/format.js'
import { Button } from './ui/index.js'

const STYLES = {
  confirmed_fraud: { box: 'bg-rose-50 ring-rose-600/25 text-rose-950', icon: ShieldAlert, iconBox: 'bg-rose-600 text-white' },
  lookalike_warning: { box: 'bg-amber-50 ring-amber-600/30 text-amber-950', icon: AlertTriangle, iconBox: 'bg-amber-500 text-white' },
  verified: { box: 'bg-emerald-50 ring-emerald-600/25 text-emerald-950', icon: BadgeCheck, iconBox: 'bg-emerald-600 text-white' },
  verified_expired: { box: 'bg-slate-100 ring-slate-400/40 text-slate-800', icon: Clock3, iconBox: 'bg-slate-500 text-white' },
  not_reviewed: { box: 'bg-white ring-slate-300 text-slate-800', icon: CircleHelp, iconBox: 'bg-slate-200 text-slate-700' },
}

const TITLES = {
  confirmed_fraud: 'Confirmed fraud',
  lookalike_warning: 'Look-alike warning',
  verified: 'Verified by your placement cell',
  verified_expired: 'Verification expired',
  not_reviewed: 'Not reviewed',
}

const day = (iso) => formatDate(iso, 'an unknown date')

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
 * links on fraud matches (the server only sends those to staff). `preview` renders a static sample
 * (landing page) that is not announced as a live result.
 */
export default function LookupResultCard({ result, query, showAskButton = true, size = 'md', preview = false, className }) {
  const navigate = useNavigate()
  const style = STYLES[result.resultStatus] ?? STYLES.not_reviewed
  const Icon = style.icon
  const sourceCases = (result.fraudMatches ?? []).flatMap((match) => match.sourceCases ?? [])
  const large = size === 'lg'

  return (
    <section
      role={preview ? 'group' : 'status'}
      aria-label={preview ? `Sample lookup result: ${TITLES[result.resultStatus]}` : 'Lookup result'}
      data-status={result.resultStatus}
      className={clsx('flex flex-col gap-3 rounded-2xl ring-1 ring-inset sm:flex-row sm:gap-4', large ? 'p-5 sm:p-6' : 'p-4', style.box, className)}
    >
      <span className={clsx('inline-flex shrink-0 items-center justify-center rounded-xl shadow-sm', large ? 'h-12 w-12' : 'h-10 w-10', style.iconBox)} aria-hidden="true">
        <Icon className={large ? 'h-6 w-6' : 'h-5 w-5'} />
      </span>
      <div className="min-w-0 flex-1 space-y-2">
        <h3 className={clsx('font-semibold tracking-tight', large ? 'text-lg' : 'text-base')}>{TITLES[result.resultStatus] ?? 'Result'}</h3>
        <p className={clsx('leading-6', large ? 'text-[15px]' : 'text-sm')}>{message(result)}</p>
        {sourceCases.length > 0 && (
          <p className="text-sm">
            Source cases (staff only):{' '}
            {sourceCases.map((item, index) => (
              <span key={item.id}>
                {index > 0 && ', '}
                <Link to={`/staff/cases/${item.id}`} className="font-mono font-medium underline underline-offset-2">
                  {item.caseNumber ?? item.id}
                </Link>
              </span>
            ))}
          </p>
        )}
        {showAskButton && (
          <Button variant="secondary" iconRight={ArrowRight} className="h-auto! min-h-10 max-w-full whitespace-normal! py-2 text-left" onClick={() => navigate(`/student/requests/new?${prefillParams(query, result.queryType)}`)}>
            Ask your placement cell to verify
          </Button>
        )}
      </div>
    </section>
  )
}
