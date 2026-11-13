import { DECISION_CHECK_LABELS, DECISION_TYPE_LABELS, DISMISS_REASON_LABELS, INDICATOR_TYPE_LABELS } from '../constants/caseStatus.js'
import { FilePlus2, Gavel, Megaphone, RotateCcw } from 'lucide-react'
import { formatDateTime } from '../utils/format.js'
import { Button, Card, CodeChip } from './ui/index.js'

function DecisionDetails({ decision }) {
  return (
    <dl className="space-y-3 text-sm">
      <div>
        <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">Basis (staff only)</dt>
        <dd className="whitespace-pre-wrap text-slate-900">{decision.basis}</dd>
      </div>
      {decision.checks?.length > 0 && (
        <div>
          <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">Checks</dt>
          <dd>
            <ul className="mt-1 list-disc space-y-0.5 pl-5 text-slate-900">
              {decision.checks.map((check) => (
                <li key={check}>{DECISION_CHECK_LABELS[check] ?? check}</li>
              ))}
            </ul>
          </dd>
        </div>
      )}
      {decision.confirmedIndicators?.length > 0 && (
        <div>
          <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">Confirmed indicators</dt>
          <dd className="mt-1 flex flex-wrap gap-1.5">
            {decision.confirmedIndicators.map((item) => (
              <CodeChip key={`${item.type}:${item.value}`} tone="danger">
                {`${INDICATOR_TYPE_LABELS[item.type] ?? item.type}: ${item.value}`}
              </CodeChip>
            ))}
          </dd>
        </div>
      )}
      {decision.verifiedDomains?.length > 0 && (
        <div>
          <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">Verified domains</dt>
          <dd className="mt-1 flex flex-wrap gap-1.5">
            {decision.verifiedDomains.map((domain) => (
              <CodeChip key={domain} tone="success">
                {domain}
              </CodeChip>
            ))}
          </dd>
        </div>
      )}
      {decision.dismissReason && (
        <div>
          <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">Dismiss reason</dt>
          <dd className="text-slate-900">{DISMISS_REASON_LABELS[decision.dismissReason]}</dd>
        </div>
      )}
      <div>
        <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">Message to the student</dt>
        <dd className="whitespace-pre-wrap text-slate-900">{decision.studentMessage}</dd>
      </div>
      <p className="text-xs text-slate-500">
        Decided by {decision.decidedBy?.name ?? 'TPO head'} · {formatDateTime(decision.decidedAt)}
      </p>
    </dl>
  )
}

/** Closed-case summary for staff, with the decision history and (for the head) a Reopen button. */
export default function DecisionSummary({
  decision,
  history = [],
  canReopen,
  onReopen,
  canAddRecruiter = false,
  onAddRecruiter,
  canDraftAdvisory = false,
  onDraftAdvisory,
}) {
  return (
    <Card title="Decision" icon={Gavel}>
      {decision ? (
        <>
          <p className="text-lg font-semibold tracking-tight text-slate-900">{DECISION_TYPE_LABELS[decision.type]}</p>
          <DecisionDetails decision={decision} />
        </>
      ) : (
        <p className="text-sm text-slate-600">This case is closed without a recorded decision.</p>
      )}
      <div className="flex flex-wrap gap-2">
        {canAddRecruiter && (
          <Button icon={FilePlus2} onClick={onAddRecruiter}>
            Add to recruiter registry
          </Button>
        )}
        {canDraftAdvisory && (
          <Button icon={Megaphone} onClick={onDraftAdvisory}>
            Draft advisory from this case
          </Button>
        )}
        {canReopen && (
          <Button variant="secondary" icon={RotateCcw} onClick={onReopen}>
            Reopen case
          </Button>
        )}
      </div>
      {history.length > 0 && (
        <details className="rounded-xl bg-slate-50 px-3 py-2 text-sm ring-1 ring-inset ring-slate-200">
          <summary className="cursor-pointer font-medium text-slate-700">Earlier decisions ({history.length})</summary>
          <ul className="mt-2 space-y-3">
            {history.map((entry) => (
              <li key={entry.reopenedAt} className="rounded-xl bg-white p-3 ring-1 ring-slate-900/5">
                <p className="font-medium text-slate-900">{DECISION_TYPE_LABELS[entry.type]}</p>
                <DecisionDetails decision={entry} />
                <p className="mt-1 text-xs text-slate-600">
                  Reopened by {entry.reopenedBy?.name ?? 'TPO head'}: {entry.reopenReason}
                </p>
              </li>
            ))}
          </ul>
        </details>
      )}
    </Card>
  )
}
