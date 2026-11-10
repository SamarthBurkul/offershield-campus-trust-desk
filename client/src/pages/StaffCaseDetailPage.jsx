import { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { deskErrorMessage, errorMessage } from '../api/errors.js'
import * as staffCases from '../api/staffCases.js'
import { ROLES } from '../auth/roles.js'
import { useAuth } from '../auth/useAuth.js'
import AssigneeSelect from '../components/AssigneeSelect.jsx'
import CaseTimeline from '../components/CaseTimeline.jsx'
import Composer from '../components/Composer.jsx'
import DecisionForm from '../components/DecisionForm.jsx'
import DecisionSummary from '../components/DecisionSummary.jsx'
import EvidenceList from '../components/EvidenceList.jsx'
import IndicatorList from '../components/IndicatorList.jsx'
import NotesPanel from '../components/NotesPanel.jsx'
import RecommendationForm, { CurrentRecommendation } from '../components/RecommendationForm.jsx'
import ReopenDialog from '../components/ReopenDialog.jsx'
import StatusBadge from '../components/StatusBadge.jsx'
import { Button, Card, ErrorAlert } from '../components/ui.jsx'
import { CHANNEL_LABELS, MONEY_PURPOSE_LABELS, PRIORITY_LABELS, isClosedStatus } from '../constants/caseStatus.js'

const yesNo = (value) => (value ? 'Yes' : 'No')

function Detail({ term, children }) {
  return (
    <div>
      <dt className="text-slate-500">{term}</dt>
      <dd className="break-words text-slate-900">{children}</dd>
    </div>
  )
}

export default function StaffCaseDetailPage() {
  const { id } = useParams()
  const { user } = useAuth()
  const [data, setData] = useState(null)
  const [loadError, setLoadError] = useState('')
  const [banner, setBanner] = useState('')
  const [reopening, setReopening] = useState(false)
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    let active = true
    staffCases
      .getStaffCase(id)
      .then((result) => {
        if (!active) return
        setData(result)
        setLoadError('')
      })
      .catch((err) => active && setLoadError(errorMessage(err, 'Could not load this case.')))
    return () => {
      active = false
    }
  }, [id, reloadKey])

  /** Run a mutation; the server answers with the refreshed case. Errors surface as display messages. */
  const run = useCallback(async (action) => {
    setBanner('')
    try {
      setData(await action())
    } catch (err) {
      const message = deskErrorMessage(err)
      if (err?.response?.status === 409) setBanner(message)
      throw new Error(message)
    }
  }, [])

  if (loadError) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold text-slate-900">Case not available</h1>
        <ErrorAlert message={loadError} />
        <Link to="/staff/cases" className="font-medium text-blue-700 hover:underline">
          Back to the case desk
        </Link>
      </div>
    )
  }
  if (!data) return <p className="text-slate-600">Loading…</p>

  const isHead = user.role === ROLES.TPO_HEAD
  const closed = isClosedStatus(data.status)
  const money = data.moneyRequested

  async function compose(kind, text) {
    const actions = {
      message: () => staffCases.sendStaffMessage(data.id, text),
      info: () => staffCases.requestInfo(data.id, text),
      note: () => staffCases.addNote(data.id, text),
    }
    await run(actions[kind])
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Link to="/staff/cases" className="text-sm font-medium text-blue-700 hover:underline">
          ← Case desk
        </Link>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="font-mono text-2xl font-bold text-slate-900">{data.caseNumber}</h1>
            <StatusBadge status={data.status} audience="staff" />
            <span className={`text-sm ${data.priority === 'high' ? 'font-semibold text-red-700' : 'text-slate-600'}`}>
              {PRIORITY_LABELS[data.priority]} priority
            </span>
            {data.isStale && <span className="rounded bg-amber-100 px-1.5 py-0.5 text-xs font-medium text-amber-900">Stale</span>}
          </div>
          <AssigneeSelect
            user={user}
            assignee={data.assignee}
            disabled={closed}
            onAssign={(assigneeId) => run(() => staffCases.assignCase(data.id, assigneeId)).catch(() => {})}
          />
        </div>
        {data.status === 'awaiting_student' && (
          <Button variant="secondary" onClick={() => run(() => staffCases.setCaseStatus(data.id, 'under_review')).catch(() => {})}>
            Resume review without a reply
          </Button>
        )}
      </div>

      {banner && (
        <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <span>{banner}</span>
          <Button
            variant="secondary"
            onClick={() => {
              setBanner('')
              setReloadKey((value) => value + 1)
            }}
          >
            Refresh
          </Button>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)_minmax(0,1fr)]">
        <div className="space-y-6">
          <Card title="Offer">
            <dl className="grid gap-3 text-sm">
              <Detail term="Company (as claimed)">{data.claimedCompany}</Detail>
              {data.roleTitle && <Detail term="Role">{data.roleTitle}</Detail>}
              <Detail term="Channel">{CHANNEL_LABELS[data.channel] ?? data.channel}</Detail>
              <Detail term="Received">{new Date(data.receivedAt).toLocaleDateString()}</Detail>
            </dl>
            <p className="whitespace-pre-wrap rounded bg-slate-50 p-3 text-sm text-slate-800">{data.messageText}</p>
            {data.studentNote && (
              <Detail term="Student note">
                <span className="whitespace-pre-wrap">{data.studentNote}</span>
              </Detail>
            )}
          </Card>
          <Card title="Money">
            <dl className="grid gap-2 text-sm">
              <Detail term="Money requested">{yesNo(money.requested)}</Detail>
              {money.requested && <Detail term="Amount">{money.amount == null ? 'Not stated' : `₹${money.amount}`}</Detail>}
              {money.requested && <Detail term="Purpose">{MONEY_PURPOSE_LABELS[money.purpose] ?? 'Not stated'}</Detail>}
              <Detail term="Already paid">{yesNo(data.paidAlready)}</Detail>
              <Detail term="Documents shared">{yesNo(data.documentsShared)}</Detail>
            </dl>
          </Card>
          <Card title="Student">
            {data.student ? (
              <dl className="grid gap-2 text-sm">
                <Detail term="Name">{data.student.name}</Detail>
                <Detail term="Email">{data.student.email}</Detail>
                <Detail term="Branch / year">
                  {data.student.branch} · Year {data.student.year}
                </Detail>
              </dl>
            ) : (
              <p className="text-sm text-slate-600">Student account not found.</p>
            )}
          </Card>
          <Card title="Indicators">
            <IndicatorList indicators={data.indicators} />
          </Card>
          <Card title="Evidence">
            <EvidenceList caseId={data.id} evidence={data.evidence} />
          </Card>
        </div>

        <div className="space-y-6">
          <Card title="Timeline">
            <CaseTimeline events={data.events} showVisibility />
          </Card>
          <Composer key={`${data.id}:${closed}`} closed={closed} onSubmit={compose} />
          <NotesPanel notes={data.notes} />
        </div>

        <div className="space-y-6">
          {closed ? (
            <DecisionSummary decision={data.decision} history={data.decisionHistory} canReopen={isHead} onReopen={() => setReopening(true)} />
          ) : isHead ? (
            <>
              <Card title="Recommendation">
                <CurrentRecommendation recommendation={data.recommendation} />
              </Card>
              <DecisionForm key={data.updatedAt} caseData={data} onDecide={(decision) => run(() => staffCases.recordDecision(data.id, decision))} />
            </>
          ) : (
            <RecommendationForm recommendation={data.recommendation} onRecommend={(recommendation) => run(() => staffCases.recommend(data.id, recommendation))} />
          )}
          {!closed && data.decisionHistory.length > 0 && <DecisionSummary decision={null} history={data.decisionHistory} canReopen={false} />}
        </div>
      </div>

      {reopening && (
        <ReopenDialog
          onCancel={() => setReopening(false)}
          onReopen={async (reason) => {
            await run(() => staffCases.reopenCase(data.id, reason))
            setReopening(false)
          }}
        />
      )}
    </div>
  )
}
