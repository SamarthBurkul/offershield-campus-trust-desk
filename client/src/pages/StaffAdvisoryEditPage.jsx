import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { createAdvisory, getStaffAdvisory, publishAdvisory, updateAdvisory, withdrawAdvisory } from '../api/advisories.js'
import { errorMessage } from '../api/errors.js'
import { listIndicators } from '../api/registry.js'
import { getStaffCase } from '../api/staffCases.js'
import { ROLES } from '../auth/roles.js'
import { useAuth } from '../auth/useAuth.js'
import AdvisoryCard from '../components/AdvisoryCard.jsx'
import AdvisoryEditor from '../components/AdvisoryEditor.jsx'
import ConfirmDialog from '../components/ConfirmDialog.jsx'
import Skeleton from '../components/Skeleton.jsx'
import { Button, Card, ErrorAlert, TextAreaField } from '../components/ui.jsx'
import usePageTitle from '../hooks/usePageTitle.js'

/** Prefill from a confirmed_fraud case: no student identity, only the claimed company and confirmed indicators. */
async function draftFromCase(caseId) {
  const [caseData, { indicators }] = await Promise.all([getStaffCase(caseId), listIndicators({ status: 'active', limit: 100 })])
  const confirmed = caseData.decision?.confirmedIndicators ?? []
  return {
    title: `Fraudulent offer using the name "${caseData.claimedCompany}"`.slice(0, 120),
    body: [
      `Your placement cell has confirmed a fraudulent job/internship offer that uses the name "${caseData.claimedCompany}".`,
      'Genuine recruiters never charge fees for registration, training, onboarding or documents.',
      'What to do: do not pay anything, do not share documents or OTPs, and do not use the contacts listed below. Ask your placement cell to verify any similar offer. If you already paid, call 1930 or report at cybercrime.gov.in.',
    ].join('\n\n'),
    severity: 'critical',
    indicatorIds: indicators.filter((item) => confirmed.some((c) => c.type === item.type && c.value === item.value)).map((item) => item.id),
    sourceCaseId: caseData.id,
  }
}

const toInitial = (advisory) => ({
  id: advisory.id,
  title: advisory.title,
  body: advisory.body,
  severity: advisory.severity,
  target: advisory.target,
  indicatorIds: advisory.indicatorIds,
  sourceCaseId: advisory.sourceCaseId,
})

function PublishedView({ advisory, isHead, onWithdraw }) {
  const [withdrawing, setWithdrawing] = useState(false)
  const [reason, setReason] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const pct = Math.round((advisory.ackRate ?? 0) * 100)

  async function confirm() {
    if (reason.trim().length < 10) return setError('Give a reason of at least 10 characters.')
    setBusy(true)
    try {
      await onWithdraw(reason.trim())
      setWithdrawing(false)
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
      <Card title={advisory.status === 'withdrawn' ? 'Withdrawn advisory' : 'Published advisory'}>
        <AdvisoryCard advisory={advisory} />
        {advisory.needsReview && (
          <p className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">
            Needs review: a linked indicator was revoked. Students no longer see it. Consider withdrawing and publishing a corrected advisory.
          </p>
        )}
        {advisory.status === 'withdrawn' && <p className="text-sm text-slate-700">Withdrawn: {advisory.withdrawReason}</p>}
        {isHead && advisory.status === 'published' && (
          <Button variant="danger" onClick={() => setWithdrawing(true)}>
            Withdraw advisory
          </Button>
        )}
      </Card>
      <Card title="Acknowledgements">
        <p className="text-2xl font-bold text-slate-900">{pct}%</p>
        <p className="text-sm text-slate-600">
          {advisory.acknowledgedCount} of {advisory.audienceCount ?? 0} students confirmed they read it.
        </p>
        {advisory.acknowledgementBreakdown && (
          <div className="grid grid-cols-2 gap-4 text-sm">
            <ul aria-label="By year">
              {advisory.acknowledgementBreakdown.byYear.map((row) => (
                <li key={row.year}>Year {row.year}: {row.count}</li>
              ))}
            </ul>
            <ul aria-label="By branch">
              {advisory.acknowledgementBreakdown.byBranch.map((row) => (
                <li key={row.branch}>{row.branch}: {row.count}</li>
              ))}
            </ul>
          </div>
        )}
      </Card>
      {withdrawing && (
        <ConfirmDialog title="Withdraw this advisory?" confirmLabel="Withdraw" danger busy={busy} onConfirm={confirm} onCancel={() => setWithdrawing(false)}>
          <p>Students will no longer see it. Existing notifications will open a "withdrawn" notice.</p>
          <TextAreaField label="Reason (staff only)" rows={3} value={reason} onChange={(event) => setReason(event.target.value)} />
          <ErrorAlert message={error} />
        </ConfirmDialog>
      )}
    </div>
  )
}

export default function StaffAdvisoryEditPage() {
  const { id } = useParams()
  const [searchParams] = useSearchParams()
  const fromCase = searchParams.get('fromCase')
  const navigate = useNavigate()
  const { user, college } = useAuth()
  const isHead = user.role === ROLES.TPO_HEAD
  const [state, setState] = useState({ loading: true, advisory: null, initial: null, error: '' })
  usePageTitle(id ? 'Advisory' : 'New advisory')

  useEffect(() => {
    let active = true
    const load = id ? getStaffAdvisory(id).then((advisory) => ({ advisory, initial: toInitial(advisory) })) : fromCase ? draftFromCase(fromCase).then((initial) => ({ advisory: null, initial })) : Promise.resolve({ advisory: null, initial: {} })
    load
      .then((result) => active && setState({ loading: false, error: '', ...result }))
      .catch((err) => active && setState({ loading: false, advisory: null, initial: null, error: errorMessage(err, 'Could not load this advisory.') }))
    return () => {
      active = false
    }
  }, [id, fromCase])

  async function save(body, savedId) {
    return savedId ? updateAdvisory(savedId, body) : createAdvisory(body)
  }

  async function publish(advisoryId) {
    const advisory = await publishAdvisory(advisoryId)
    navigate(`/staff/advisories/${advisory.id}`, { replace: true })
    setState({ loading: false, error: '', advisory, initial: toInitial(advisory) })
  }

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <Link to="/staff/advisories" className="text-sm font-medium text-blue-700 hover:underline">
          ← Advisories
        </Link>
        <h1 className="text-2xl font-bold text-slate-900">{id ? 'Advisory' : 'New advisory'}</h1>
        {fromCase && <p className="text-sm text-slate-600">Prefilled from a confirmed fraud case. Check the wording before saving.</p>}
      </div>
      {state.loading && <Skeleton rows={4} label="Loading advisory" />}
      <ErrorAlert message={state.error} />
      {!state.loading && !state.error && (state.advisory && state.advisory.status !== 'draft' ? (
        <PublishedView
          advisory={state.advisory}
          isHead={isHead}
          onWithdraw={async (reason) => {
            const advisory = await withdrawAdvisory(state.advisory.id, reason)
            setState((current) => ({ ...current, advisory }))
          }}
        />
      ) : (
        <AdvisoryEditor key={state.initial?.id ?? 'new'} initial={state.initial ?? {}} isHead={isHead} branches={college?.branches ?? []} onSave={save} onPublish={publish} />
      ))}
    </div>
  )
}
