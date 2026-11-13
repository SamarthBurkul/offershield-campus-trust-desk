import clsx from 'clsx'
import { ArrowLeft, BadgeCheck, CircleHelp, CircleSlash, FileX, History, Paperclip, Send, ShieldAlert, Upload } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, useLocation, useParams } from 'react-router-dom'
import { getCase, sendMessage, uploadEvidence } from '../api/cases.js'
import { errorMessage } from '../api/errors.js'
import CaseTimeline from '../components/CaseTimeline.jsx'
import EvidenceList from '../components/EvidenceList.jsx'
import EvidencePicker from '../components/EvidencePicker.jsx'
import IndicatorList from '../components/IndicatorList.jsx'
import StatusBadge from '../components/StatusBadge.jsx'
import { Button, ButtonLink, Card, EmptyState, ErrorAlert, KeyValueList, Skeleton, TextAreaField } from '../components/ui/index.js'
import {
  CHANNEL_LABELS,
  EVIDENCE_RULES,
  MONEY_PURPOSE_LABELS,
  STUDENT_OUTCOME_COPY,
  isClosedStatus,
} from '../constants/caseStatus.js'
import usePageTitle from '../hooks/usePageTitle.js'
import { formatDate, formatMoney } from '../utils/format.js'

const yesNo = (value) => (value ? 'Yes' : 'No')

// Outcome card styling: semantic colour only for the meaning of the decision.
const OUTCOME_STYLES = {
  confirmed_fraud: { box: 'bg-rose-50 ring-rose-600/25 text-rose-950', iconBox: 'bg-rose-600 text-white', icon: ShieldAlert },
  verified_genuine: { box: 'bg-emerald-50 ring-emerald-600/25 text-emerald-950', iconBox: 'bg-emerald-600 text-white', icon: BadgeCheck },
  inconclusive: { box: 'bg-violet-50 ring-violet-600/20 text-violet-950', iconBox: 'bg-violet-600 text-white', icon: CircleHelp },
  dismissed: { box: 'bg-slate-100 ring-slate-400/40 text-slate-900', iconBox: 'bg-slate-500 text-white', icon: CircleSlash },
}

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
      <div className="mx-auto max-w-xl space-y-4">
        <EmptyState
          icon={FileX}
          as="h1"
          title="Request not available"
          action={
            <ButtonLink to="/student/requests" variant="secondary" icon={ArrowLeft}>
              Back to my requests
            </ButtonLink>
          }
        >
          {loadError}
        </EmptyState>
      </div>
    )
  }
  if (!data) return <Skeleton rows={4} label="Loading request" />

  const { case: request, events, evidence } = data
  const closed = isClosedStatus(request.status)
  const money = request.moneyRequested
  const outcome = OUTCOME_STYLES[request.status] ?? OUTCOME_STYLES.dismissed
  const OutcomeIcon = outcome.icon

  return (
    <div className="space-y-6">
      <nav aria-label="Breadcrumb" className="text-sm">
        <Link to="/student/requests" className="inline-flex items-center gap-1 font-medium text-slate-600 transition hover:text-accent-700">
          <ArrowLeft className="h-4 w-4" aria-hidden="true" /> My requests
        </Link>
      </nav>

      <Card>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0 space-y-2">
            <p className="font-mono text-xs font-medium text-slate-500">{request.caseNumber}</p>
            <h1 className="text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">{request.claimedCompany}</h1>
            <p className="text-sm text-slate-500">
              {CHANNEL_LABELS[request.channel] ?? request.channel} · received {formatDate(request.receivedAt)}
            </p>
          </div>
          <StatusBadge status={request.status} />
        </div>
        <p className="text-sm text-slate-600">
          &ldquo;Confirmed fraud&rdquo; and &ldquo;Verified&rdquo; only ever come from a decision by your placement cell.
          Automated checks only highlight details for them.
        </p>
      </Card>

      {location.state?.uploadFailed && (
        <ErrorAlert message="Your request was submitted, but the evidence could not be uploaded. Please add it again below." />
      )}

      {closed && (
        <section aria-label="Outcome" className={clsx('flex gap-4 rounded-2xl p-5 ring-1 ring-inset sm:p-6', outcome.box)}>
          <span className={clsx('inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-xl', outcome.iconBox)} aria-hidden="true">
            <OutcomeIcon className="h-6 w-6" />
          </span>
          <div className="min-w-0 flex-1 space-y-2">
            <div className="flex flex-wrap items-center gap-3">
              <h2 className="text-lg font-semibold tracking-tight">Outcome</h2>
              <StatusBadge status={request.status} />
            </div>
            <p className="font-medium">{STUDENT_OUTCOME_COPY[request.status]}</p>
            {request.decision?.message && (
              <p className="whitespace-pre-wrap rounded-xl bg-white/80 p-3 text-slate-800 ring-1 ring-inset ring-slate-900/5">{request.decision.message}</p>
            )}
            {request.decision?.decidedAt && <p className="text-xs opacity-75">Decided {formatDate(request.decision.decidedAt)}</p>}
          </div>
        </section>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <Card title="Timeline" icon={History}>
          <CaseTimeline events={events} />
          {closed ? (
            <p className="rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-600">This request is closed, so replies are turned off.</p>
          ) : (
            <ReplyBox caseId={request.id} onSent={setData} />
          )}
        </Card>

        <div className="space-y-6">
          <Card title="Summary">
            <KeyValueList
              columns={2}
              items={[request.roleTitle && { term: 'Role', value: request.roleTitle }, { term: 'Documents already shared', value: yesNo(request.documentsShared) }]}
            />
            <div>
              <h3 className="text-xs font-medium uppercase tracking-wide text-slate-500">Message you received</h3>
              <p className="mt-1.5 whitespace-pre-wrap rounded-xl bg-slate-50 p-3 text-sm leading-6 text-slate-800">{request.messageText}</p>
            </div>
            {request.studentNote && (
              <div>
                <h3 className="text-xs font-medium uppercase tracking-wide text-slate-500">Your note</h3>
                <p className="mt-1.5 whitespace-pre-wrap text-sm text-slate-800">{request.studentNote}</p>
              </div>
            )}
          </Card>

          <Card title="Money">
            <KeyValueList
              columns={2}
              items={[
                { term: 'Money requested', value: yesNo(money.requested) },
                money.requested && { term: 'Amount', value: money.amount == null ? 'Not stated' : formatMoney(money.amount) },
                money.requested && { term: 'Purpose', value: MONEY_PURPOSE_LABELS[money.purpose] ?? 'Not stated' },
                { term: 'Already paid', value: yesNo(request.paidAlready) },
              ]}
            />
          </Card>

          <Card title="Details we found">
            <p className="text-sm text-slate-600">
              Contact details taken from your request. They help your placement cell check records; they are not a verdict.
            </p>
            <IndicatorList indicators={request.indicators} />
          </Card>

          <Card title="Evidence" icon={Paperclip}>
            <EvidenceList caseId={request.id} evidence={evidence} />
            {!closed && evidence.length < EVIDENCE_RULES.maxFilesPerCase && (
              <AddEvidence caseId={request.id} uploadedCount={evidence.length} onUploaded={(added) => setData({ ...data, evidence: [...evidence, ...added] })} />
            )}
          </Card>
        </div>
      </div>
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
    <form onSubmit={handleSubmit} className="space-y-3 border-t border-slate-100 pt-5">
      <TextAreaField label="Reply to your placement cell" rows={3} value={body} onChange={(event) => setBody(event.target.value)} />
      <ErrorAlert message={error} />
      <Button type="submit" icon={Send} loading={sending} disabled={body.trim().length === 0}>
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
        <Button icon={Upload} loading={uploading} onClick={upload}>
          {uploading ? 'Uploading…' : `Upload ${files.length} file${files.length === 1 ? '' : 's'}`}
        </Button>
      )}
    </div>
  )
}
