import { useEffect, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { createAdvisory, getStaffAdvisory, publishAdvisory, updateAdvisory, withdrawAdvisory } from '../api/advisories.js'
import { errorMessage } from '../api/errors.js'
import { listIndicators } from '../api/registry.js'
import { getStaffCase } from '../api/staffCases.js'
import { ROLES } from '../auth/roles.js'
import { useAuth } from '../auth/useAuth.js'
import AdvisoryCard from '../components/AdvisoryCard.jsx'
import AdvisoryEditor from '../components/AdvisoryEditor.jsx'
import ConfirmDialog from '../components/ConfirmDialog.jsx'
import { Skeleton } from '../components/ui/index.js'
import { Megaphone, Undo2, Users } from 'lucide-react'
import { Alert, Button, Card, ErrorAlert, PageHeader, ProgressBar, TextAreaField } from '../components/ui/index.js'
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
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
      <Card title={advisory.status === 'withdrawn' ? 'Withdrawn advisory' : 'Published advisory'} icon={Megaphone}>
        <AdvisoryCard advisory={advisory} />
        {advisory.needsReview && (
          <Alert variant="warning">
            Needs review: a linked indicator was revoked. Students no longer see it. Consider withdrawing and publishing a corrected advisory.
          </Alert>
        )}
        {advisory.status === 'withdrawn' && <Alert variant="info">Withdrawn: {advisory.withdrawReason}</Alert>}
        {isHead && advisory.status === 'published' && (
          <Button variant="danger" icon={Undo2} onClick={() => setWithdrawing(true)}>
            Withdraw advisory
          </Button>
        )}
      </Card>
      <Card title="Acknowledgements" icon={Users} className="xl:self-start">
        <div className="flex items-end justify-between gap-3">
          <p className="text-4xl font-semibold tracking-tight text-slate-900 tabular-nums">{pct}%</p>
          <p className="text-sm text-slate-600">
            {advisory.acknowledgedCount} of {advisory.audienceCount ?? 0} students confirmed they read it.
          </p>
        </div>
        <ProgressBar value={advisory.ackRate ?? 0} label="Acknowledgement rate" tone="success" />
        {advisory.acknowledgementBreakdown && (
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-slate-500">By year</p>
              <ul aria-label="By year" className="space-y-1">
                {advisory.acknowledgementBreakdown.byYear.map((row) => (
                  <li key={row.year} className="flex justify-between">
                    <span>Year {row.year}</span>
                    <span className="font-medium tabular-nums">{row.count}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-slate-500">By branch</p>
              <ul aria-label="By branch" className="space-y-1">
                {advisory.acknowledgementBreakdown.byBranch.map((row) => (
                  <li key={row.branch} className="flex justify-between">
                    <span>{row.branch}</span>
                    <span className="font-medium tabular-nums">{row.count}</span>
                  </li>
                ))}
              </ul>
            </div>
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
      <PageHeader
        breadcrumb={[{ label: 'Advisories', to: '/staff/advisories' }, { label: id ? 'Advisory' : 'New advisory' }]}
        title={id ? 'Advisory' : 'New advisory'}
        description={fromCase ? 'Prefilled from a confirmed fraud case. Check the wording before saving.' : undefined}
      />
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
