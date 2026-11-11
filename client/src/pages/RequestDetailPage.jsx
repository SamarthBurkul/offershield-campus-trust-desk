import { useEffect, useState } from 'react'
import { Link, useLocation, useParams } from 'react-router-dom'
import { getCase, sendMessage, uploadEvidence } from '../api/cases.js'
import { errorMessage } from '../api/errors.js'
import CaseTimeline from '../components/CaseTimeline.jsx'
import EvidenceList from '../components/EvidenceList.jsx'
import EvidencePicker from '../components/EvidencePicker.jsx'
import IndicatorList from '../components/IndicatorList.jsx'
import StatusBadge from '../components/StatusBadge.jsx'
import { Button, Card, ErrorAlert, TextAreaField } from '../components/ui.jsx'
import {
  CHANNEL_LABELS,
  EVIDENCE_RULES,
  MONEY_PURPOSE_LABELS,
  STUDENT_OUTCOME_COPY,
  isClosedStatus,
} from '../constants/caseStatus.js'
import usePageTitle from '../hooks/usePageTitle.js'
import Skeleton from '../components/Skeleton.jsx'

const yesNo = (value) => (value ? 'Yes' : 'No')

export default function RequestDetailPage() {
  usePageTitle('Request')
  const { id } = useParams()
  const location = useLocation()
  const [data, setData] = useState(null)
  const [loadError, setLoadError] = useState('')

  useEffect(() => {
    let active = true
    getCase(id)
      .then((result) => active && setData(result))
      .catch((err) => active && setLoadError(errorMessage(err, 'Could not load this request.')))
    return () => {
      active = false
    }
  }, [id])

  if (loadError) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold text-slate-900">Request not available</h1>
        <ErrorAlert message={loadError} />
        <Link to="/student/requests" className="font-medium text-blue-700 hover:underline">
          Back to my requests
        </Link>
      </div>
    )
  }
  if (!data) return <Skeleton rows={4} label="Loading request" />

  const { case: request, events, evidence } = data
  const closed = isClosedStatus(request.status)
  const money = request.moneyRequested

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Link to="/student/requests" className="text-sm font-medium text-blue-700 hover:underline">
          ← My requests
        </Link>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-bold text-slate-900">{request.claimedCompany}</h1>
          <StatusBadge status={request.status} />
        </div>
        <p className="text-sm text-slate-500">
          {request.caseNumber} · {CHANNEL_LABELS[request.channel] ?? request.channel} · received{' '}
          {new Date(request.receivedAt).toLocaleDateString()}
        </p>
        <p className="text-sm text-slate-600">
          &ldquo;Confirmed fraud&rdquo; and &ldquo;Verified&rdquo; only ever come from a decision by your placement cell.
          Automated checks only highlight details for them.
        </p>
      </div>

      {location.state?.uploadFailed && (
        <ErrorAlert message="Your request was submitted, but the evidence could not be uploaded. Please add it again below." />
      )}

      {closed && (
        <section aria-label="Outcome" className="space-y-2 rounded-lg border border-slate-300 bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="text-lg font-semibold text-slate-900">Outcome</h2>
            <StatusBadge status={request.status} />
          </div>
          <p className="font-medium text-slate-900">{STUDENT_OUTCOME_COPY[request.status]}</p>
          {request.decision?.message && (
            <p className="whitespace-pre-wrap rounded bg-slate-50 p-3 text-slate-800">{request.decision.message}</p>
          )}
          {request.decision?.decidedAt && (
            <p className="text-xs text-slate-500">Decided {new Date(request.decision.decidedAt).toLocaleDateString()}</p>
          )}
        </section>
      )}

      <Card title="Summary">
        <dl className="grid gap-3 text-sm sm:grid-cols-2">
          {request.roleTitle && <Detail term="Role">{request.roleTitle}</Detail>}
          <Detail term="Documents already shared">{yesNo(request.documentsShared)}</Detail>
        </dl>
        <div>
          <h3 className="text-sm font-medium text-slate-700">Message you received</h3>
          <p className="mt-1 whitespace-pre-wrap rounded bg-slate-50 p-3 text-sm text-slate-800">{request.messageText}</p>
        </div>
        {request.studentNote && (
          <div>
            <h3 className="text-sm font-medium text-slate-700">Your note</h3>
            <p className="mt-1 whitespace-pre-wrap text-sm text-slate-800">{request.studentNote}</p>
          </div>
        )}
      </Card>

      <Card title="Money">
        <dl className="grid gap-3 text-sm sm:grid-cols-3">
          <Detail term="Money requested">{yesNo(money.requested)}</Detail>
          {money.requested && <Detail term="Amount">{money.amount == null ? 'Not stated' : `₹${money.amount}`}</Detail>}
          {money.requested && <Detail term="Purpose">{MONEY_PURPOSE_LABELS[money.purpose] ?? 'Not stated'}</Detail>}
          <Detail term="Already paid">{yesNo(request.paidAlready)}</Detail>
        </dl>
      </Card>

      <Card title="Details we found">
        <p className="text-sm text-slate-600">
          Contact details taken from your request. They help your placement cell check records; they are not a verdict.
        </p>
        <IndicatorList indicators={request.indicators} />
      </Card>

      <Card title="Evidence">
        <EvidenceList caseId={request.id} evidence={evidence} />
        {!closed && evidence.length < EVIDENCE_RULES.maxFilesPerCase && (
          <AddEvidence caseId={request.id} uploadedCount={evidence.length} onUploaded={(added) => setData({ ...data, evidence: [...evidence, ...added] })} />
        )}
      </Card>

      <Card title="Timeline">
        <CaseTimeline events={events} />
        {closed ? (
          <p className="text-sm text-slate-600">This request is closed, so replies are turned off.</p>
        ) : (
          <ReplyBox caseId={request.id} onSent={setData} />
        )}
      </Card>
    </div>
  )
}

function Detail({ term, children }) {
  return (
    <div>
      <dt className="text-slate-500">{term}</dt>
      <dd className="text-slate-900">{children}</dd>
    </div>
  )
}

function ReplyBox({ caseId, onSent }) {
  const [body, setBody] = useState('')
  const [error, setError] = useState('')
  const [sending, setSending] = useState(false)

  async function handleSubmit(event) {
    event.preventDefault()
    setError('')
    setSending(true)
    try {
      onSent(await sendMessage(caseId, body))
      setBody('')
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setSending(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3 border-t border-slate-100 pt-4">
      <TextAreaField label="Reply to your placement cell" rows={3} value={body} onChange={(event) => setBody(event.target.value)} />
      <ErrorAlert message={error} />
      <Button type="submit" disabled={sending || body.trim().length === 0}>
        {sending ? 'Sending…' : 'Send reply'}
      </Button>
    </form>
  )
}

function AddEvidence({ caseId, uploadedCount, onUploaded }) {
  const [files, setFiles] = useState([])
  const [error, setError] = useState('')
  const [uploading, setUploading] = useState(false)

  async function upload() {
    setError('')
    setUploading(true)
    try {
      onUploaded(await uploadEvidence(caseId, files))
      setFiles([])
    } catch (err) {
      setError(errorMessage(err, 'The upload failed. Please try again.'))
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="space-y-3 border-t border-slate-100 pt-4">
      <EvidencePicker label="Add more evidence" files={files} onChange={setFiles} alreadyUploaded={uploadedCount} />
      <ErrorAlert message={error} />
      {files.length > 0 && (
        <Button disabled={uploading} onClick={upload}>
          {uploading ? 'Uploading…' : `Upload ${files.length} file${files.length === 1 ? '' : 's'}`}
        </Button>
      )}
    </div>
  )
}
