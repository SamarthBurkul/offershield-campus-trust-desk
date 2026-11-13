import { ArrowLeft, Banknote, ChevronDown, CirclePlay, FileWarning, Fingerprint, Gavel, History, Paperclip, RefreshCw, RotateCcw, UserRound } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { deskErrorMessage, errorMessage } from '../api/errors.js'
import { createRecruiter } from '../api/registry.js'
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
import RecruiterForm from '../components/RecruiterForm.jsx'
import RelatedCasesPanel from '../components/RelatedCasesPanel.jsx'
import ReopenDialog from '../components/ReopenDialog.jsx'
import SignalsPanel from '../components/SignalsPanel.jsx'
import StatusBadge from '../components/StatusBadge.jsx'
import { Alert, Avatar, Badge, Button, Card, Drawer, EmptyState, KeyValueList, Skeleton, useToast } from '../components/ui/index.js'
import { CHANNEL_LABELS, MONEY_PURPOSE_LABELS, PRIORITY_LABELS, isClosedStatus } from '../constants/caseStatus.js'
import usePageTitle from '../hooks/usePageTitle.js'
import { formatDate, formatMoney } from '../utils/format.js'

const yesNo = (value) => (value ? 'Yes' : 'No')

/** Collapsible side section (open by default). */
function Section({ title, icon: Icon, children, defaultOpen = true }) {
  return (
    <details open={defaultOpen} className="group rounded-2xl bg-white shadow-card ring-1 ring-slate-900/5">
      <summary className="flex cursor-pointer list-none items-center gap-2.5 rounded-2xl px-4 py-3 text-sm font-semibold text-slate-900 transition hover:bg-slate-50 [&::-webkit-details-marker]:hidden">
        <Icon className="h-4 w-4 text-brand-600" aria-hidden="true" />
        <span className="flex-1">{title}</span>
        <ChevronDown className="h-4 w-4 text-slate-400 transition duration-150 group-open:rotate-180" aria-hidden="true" />
      </summary>
      <div className="space-y-3 border-t border-slate-100 px-4 py-4">{children}</div>
    </details>
  )
}

export default function StaffCaseDetailPage() {
  usePageTitle('Case')
  const { id } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const toast = useToast()
  const [data, setData] = useState(null)
  const [loadError, setLoadError] = useState('')
  const [banner, setBanner] = useState('')
  const [reopening, setReopening] = useState(false)
  const [addingRecruiter, setAddingRecruiter] = useState(false)
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
      const code = err?.response?.data?.error?.code
      // Business-rule conflicts carry their own message; generic 409s mean someone else changed the case.
      const message = code === 'CONFLICTS_WITH_VERIFIED_RECRUITER' ? errorMessage(err) : deskErrorMessage(err)
      if (err?.response?.status === 409 && code !== 'CONFLICTS_WITH_VERIFIED_RECRUITER') setBanner(message)
      const error = new Error(message)
      error.code = code
      error.details = err?.response?.data?.error?.details
      throw error
    }
  }, [])

  if (loadError) {
    return (
      <div className="mx-auto max-w-xl">
        <EmptyState
          icon={FileWarning}
          as="h1"
          title="Case not available"
          action={
            <Link to="/staff/cases" className="inline-flex items-center gap-1 text-sm font-medium text-accent-700 hover:text-accent-800">
              <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Back to the case desk
            </Link>
          }
        >
          <span role="alert">{loadError}</span>
        </EmptyState>
      </div>
    )
  }
  if (!data) return <Skeleton rows={5} label="Loading case" />

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
      <nav aria-label="Breadcrumb" className="text-sm">
        <Link to="/staff/cases" className="inline-flex items-center gap-1 font-medium text-slate-600 transition hover:text-accent-700">
          <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Case desk
        </Link>
      </nav>

      <div className="sticky top-16 z-10 -mx-1 rounded-2xl bg-white/95 px-5 py-4 shadow-card ring-1 ring-slate-900/5 backdrop-blur">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex min-w-0 flex-wrap items-center gap-3">
            <h1 className="font-mono text-xl font-semibold tracking-tight text-slate-900 sm:text-2xl">{data.caseNumber}</h1>
            <StatusBadge status={data.status} audience="staff" />
            <Badge tone={data.priority === 'high' ? 'danger' : 'neutral'}>{PRIORITY_LABELS[data.priority]} priority</Badge>
            {data.isStale && <Badge tone="warning">Stale</Badge>}
            <span className="hidden truncate text-sm text-slate-500 md:inline">{data.claimedCompany}</span>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <AssigneeSelect
              user={user}
              assignee={data.assignee}
              disabled={closed}
              onAssign={(assigneeId) => run(() => staffCases.assignCase(data.id, assigneeId)).catch(() => {})}
            />
            {data.status === 'awaiting_student' && (
              <Button variant="secondary" size="sm" icon={CirclePlay} onClick={() => run(() => staffCases.setCaseStatus(data.id, 'under_review')).catch(() => {})}>
                Resume review without a reply
              </Button>
            )}
            {!closed && (
              <a href="#outcome-panel" className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-brand-900 px-3 text-xs font-medium text-white shadow-sm transition hover:bg-brand-800">
                <Gavel className="h-3.5 w-3.5" aria-hidden="true" />
                {isHead ? 'Decide' : 'Recommend'}
              </a>
            )}
            {closed && isHead && (
              <Button variant="secondary" size="sm" icon={RotateCcw} onClick={() => setReopening(true)}>
                Reopen
              </Button>
            )}
          </div>
        </div>
      </div>

      {banner && (
        <Alert
          variant="warning"
          role="alert"
          actions={
            <Button
              variant="secondary"
              size="sm"
              icon={RefreshCw}
              onClick={() => {
                setBanner('')
                setReloadKey((value) => value + 1)
              }}
            >
              Refresh
            </Button>
          }
        >
          {banner}
        </Alert>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,320px)_minmax(0,1fr)] xl:grid-cols-12">
        <div className="space-y-4 lg:row-span-2 xl:col-span-3 xl:row-span-1">
          <Section title="Offer" icon={FileWarning}>
            <KeyValueList
              items={[
                { term: 'Company (as claimed)', value: data.claimedCompany },
                data.roleTitle && { term: 'Role', value: data.roleTitle },
                { term: 'Channel', value: CHANNEL_LABELS[data.channel] ?? data.channel },
                { term: 'Received', value: formatDate(data.receivedAt) },
              ]}
            />
            <p className="whitespace-pre-wrap rounded-xl bg-slate-50 p-3 text-sm leading-6 text-slate-800 ring-1 ring-inset ring-slate-200">{data.messageText}</p>
            {data.studentNote && <KeyValueList items={[{ term: 'Student note', value: <span className="whitespace-pre-wrap">{data.studentNote}</span> }]} />}
          </Section>
          <Section title="Money" icon={Banknote}>
            <KeyValueList
              columns={2}
              items={[
                { term: 'Money requested', value: yesNo(money.requested) },
                money.requested && { term: 'Amount', value: money.amount == null ? 'Not stated' : formatMoney(money.amount) },
                money.requested && { term: 'Purpose', value: MONEY_PURPOSE_LABELS[money.purpose] ?? 'Not stated' },
                { term: 'Already paid', value: yesNo(data.paidAlready) },
                { term: 'Documents shared', value: yesNo(data.documentsShared) },
              ]}
            />
          </Section>
          <Section title="Student" icon={UserRound}>
            {data.student ? (
              <div className="flex items-start gap-3">
                <Avatar name={data.student.name} />
                <KeyValueList
                  items={[
                    { term: 'Name', value: data.student.name },
                    { term: 'Email', value: <span className="break-all">{data.student.email}</span> },
                    {
                      term: 'Branch / year',
                      value: (
                        <>
                          {data.student.branch} · Year {data.student.year}
                        </>
                      ),
                    },
                  ]}
                />
              </div>
            ) : (
              <p className="text-sm text-slate-600">Student account not found.</p>
            )}
          </Section>
          <Section title="Indicators" icon={Fingerprint}>
            <IndicatorList indicators={data.indicators} />
          </Section>
          <Section title="Evidence" icon={Paperclip}>
            <EvidenceList caseId={data.id} evidence={data.evidence} />
          </Section>
        </div>

        <div className="space-y-6 xl:col-span-6">
          <Card title="Timeline" icon={History}>
            <CaseTimeline events={data.events} showVisibility />
          </Card>
          <Composer key={`${data.id}:${closed}`} closed={closed} onSubmit={compose} />
          <NotesPanel notes={data.notes} />
        </div>

        <div className="space-y-6 lg:col-start-2 xl:col-span-3 xl:col-start-auto" id="outcome-panel">
          <SignalsPanel signals={data.signals} computedAt={data.signalsComputedAt} onRecompute={() => run(() => staffCases.recomputeSignals(data.id))} />
          <RelatedCasesPanel
            caseId={data.id}
            related={data.related}
            onLink={(otherId) => run(() => staffCases.linkCase(data.id, otherId))}
            onUnlink={(otherId) => run(() => staffCases.unlinkCase(data.id, otherId))}
          />
          {closed ? (
            <DecisionSummary
              decision={data.decision}
              history={data.decisionHistory}
              canReopen={isHead}
              onReopen={() => setReopening(true)}
              canAddRecruiter={isHead && data.decision?.type === 'verified_genuine'}
              onAddRecruiter={() => setAddingRecruiter(true)}
              canDraftAdvisory={data.decision?.type === 'confirmed_fraud'}
              onDraftAdvisory={() => navigate(`/staff/advisories/new?fromCase=${data.id}`)}
            />
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

      {addingRecruiter && (
        <Drawer title="Add to recruiter registry" description="Prefilled from this verified_genuine decision." onClose={() => setAddingRecruiter(false)}>
          <RecruiterForm
            isHead={isHead}
            initial={{
              companyName: data.claimedCompany,
              domains: data.decision?.verifiedDomains ?? [],
              methods: data.decision?.checks ?? [],
              sourceCaseId: data.id,
            }}
            onCancel={() => setAddingRecruiter(false)}
            onSubmit={async (body) => {
              try {
                await createRecruiter(body)
              } catch (err) {
                throw new Error(errorMessage(err))
              }
              setAddingRecruiter(false)
              toast.success(`${body.companyName} was added to the recruiter registry.`)
            }}
          />
        </Drawer>
      )}

      {reopening && (
        <ReopenDialog
          onCancel={() => setReopening(false)}
          onReopen={async (reason) => {
            await run(() => staffCases.reopenCase(data.id, reason))
            setReopening(false)
            toast.success('Case reopened.')
          }}
        />
      )}
    </div>
  )
}
