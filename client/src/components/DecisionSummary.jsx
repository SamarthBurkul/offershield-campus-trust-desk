import { DECISION_CHECK_LABELS, DECISION_TYPE_LABELS, DISMISS_REASON_LABELS, INDICATOR_TYPE_LABELS } from '../constants/caseStatus.js'
import { Button, Card } from './ui.jsx'

function DecisionDetails({ decision }) {
  return (
    <dl className="space-y-2 text-sm">
      <div>
        <dt className="text-slate-500">Basis (staff only)</dt>
        <dd className="whitespace-pre-wrap text-slate-900">{decision.basis}</dd>
      </div>
      {decision.checks?.length > 0 && (
        <div>
          <dt className="text-slate-500">Checks</dt>
          <dd>
            <ul className="list-disc pl-5 text-slate-900">
              {decision.checks.map((check) => (
                <li key={check}>{DECISION_CHECK_LABELS[check] ?? check}</li>
              ))}
            </ul>
          </dd>
        </div>
      )}
      {decision.confirmedIndicators?.length > 0 && (
        <div>
          <dt className="text-slate-500">Confirmed indicators</dt>
          <dd className="font-mono text-xs text-slate-900">
            {decision.confirmedIndicators.map((item) => `${INDICATOR_TYPE_LABELS[item.type] ?? item.type}: ${item.value}`).join(' · ')}
          </dd>
        </div>
      )}
      {decision.verifiedDomains?.length > 0 && (
        <div>
          <dt className="text-slate-500">Verified domains</dt>
          <dd className="font-mono text-xs text-slate-900">{decision.verifiedDomains.join(', ')}</dd>
        </div>
      )}
      {decision.dismissReason && (
        <div>
          <dt className="text-slate-500">Dismiss reason</dt>
          <dd className="text-slate-900">{DISMISS_REASON_LABELS[decision.dismissReason]}</dd>
        </div>
      )}
      <div>
        <dt className="text-slate-500">Message to the student</dt>
        <dd className="whitespace-pre-wrap text-slate-900">{decision.studentMessage}</dd>
      </div>
      <p className="text-xs text-slate-500">
        Decided by {decision.decidedBy?.name ?? 'TPO head'} · {new Date(decision.decidedAt).toLocaleString()}
      </p>
    </dl>
  )
}

/** Closed-case summary for staff, with the decision history and (for the head) a Reopen button. */
export default function DecisionSummary({ decision, history = [], canReopen, onReopen, canAddRecruiter = false, onAddRecruiter }) {
  return (
    <Card title="Decision">
      {decision ? (
        <>
          <p className="text-base font-semibold text-slate-900">{DECISION_TYPE_LABELS[decision.type]}</p>
          <DecisionDetails decision={decision} />
        </>
      ) : (
        <p className="text-sm text-slate-600">This case is closed without a recorded decision.</p>
      )}
      <div className="flex flex-wrap gap-2">
        {canAddRecruiter && <Button onClick={onAddRecruiter}>Add to recruiter registry</Button>}
        {canReopen && (
          <Button variant="secondary" onClick={onReopen}>
            Reopen case
          </Button>
        )}
      </div>
      {history.length > 0 && (
        <details className="text-sm">
          <summary className="cursor-pointer font-medium text-slate-700">Earlier decisions ({history.length})</summary>
          <ul className="mt-2 space-y-3">
            {history.map((entry) => (
              <li key={entry.reopenedAt} className="rounded-md border border-slate-200 p-3">
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
