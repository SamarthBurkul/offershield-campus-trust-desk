import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { errorMessage } from '../api/errors.js'
import * as registry from '../api/registry.js'
import { ROLES } from '../auth/roles.js'
import { useAuth } from '../auth/useAuth.js'
import ConfirmDialog from '../components/ConfirmDialog.jsx'
import RecruiterForm from '../components/RecruiterForm.jsx'
import { Button, Card, CheckboxField, ErrorAlert, TextAreaField } from '../components/ui.jsx'
import { INDICATOR_TYPE_LABELS } from '../constants/caseStatus.js'
import { RECRUITER_STATUS_LABELS, VERIFICATION_METHOD_LABELS } from '../constants/verificationMethods.js'

const TABS = [
  { value: 'recruiters', label: 'Recruiters' },
  { value: 'indicators', label: 'Confirmed indicators' },
]
const day = (iso) => (iso ? new Date(iso).toLocaleDateString() : '—')
const toggle = (list, value) => (list.includes(value) ? list.filter((item) => item !== value) : [...list, value])

function RecruiterStatus({ recruiter }) {
  if (recruiter.isExpired) return <span className="rounded-full bg-slate-200 px-2 py-0.5 text-xs font-medium text-slate-600">Expired</span>
  const classes = {
    pending_approval: 'bg-amber-100 text-amber-900',
    verified: 'bg-emerald-100 text-emerald-800',
    suspended: 'bg-slate-200 text-slate-700',
  }
  return <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${classes[recruiter.status]}`}>{RECRUITER_STATUS_LABELS[recruiter.status]}</span>
}

/** Head-only dialogs: renew (methods + note) and suspend / revoke (reason). */
function ActionDialog({ action, onDone, onCancel }) {
  const [methods, setMethods] = useState([])
  const [text, setText] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const isRenew = action.kind === 'renew'
  const min = isRenew ? 20 : 10

  async function confirm() {
    if (text.trim().length < min || (isRenew && methods.length === 0)) {
      setError(isRenew ? 'Select a method and write an evidence note of at least 20 characters.' : 'Give a reason of at least 10 characters.')
      return
    }
    setBusy(true)
    try {
      await action.run(isRenew ? { methods, evidenceNote: text.trim() } : text.trim())
      onDone()
    } catch (err) {
      setError(errorMessage(err))
      setBusy(false)
    }
  }

  return (
    <ConfirmDialog title={action.title} confirmLabel={action.confirmLabel} danger={!isRenew} busy={busy} onConfirm={confirm} onCancel={onCancel}>
      {isRenew && (
        <fieldset className="space-y-1">
          <legend className="font-medium">Verification methods</legend>
          {Object.entries(VERIFICATION_METHOD_LABELS).map(([value, label]) => (
            <CheckboxField key={value} label={label} checked={methods.includes(value)} onChange={() => setMethods(toggle(methods, value))} />
          ))}
        </fieldset>
      )}
      <TextAreaField label={isRenew ? 'Evidence note' : 'Reason'} rows={3} value={text} onChange={(event) => setText(event.target.value)} />
      <ErrorAlert message={error} />
    </ConfirmDialog>
  )
}

function RecruitersTab({ isHead }) {
  const [result, setResult] = useState(null)
  const [error, setError] = useState('')
  const [reloadKey, setReloadKey] = useState(0)
  const [creating, setCreating] = useState(false)
  const [action, setAction] = useState(null)
  const reload = () => setReloadKey((key) => key + 1)

  useEffect(() => {
    let active = true
    registry
      .listRecruiters({ limit: 50 })
      .then((data) => active && setResult(data))
      .catch((err) => active && setError(errorMessage(err, 'Could not load recruiters.')))
    return () => {
      active = false
    }
  }, [reloadKey])

  async function approve(recruiter) {
    setError('')
    try {
      await registry.approveRecruiter(recruiter.id)
      reload()
    } catch (err) {
      setError(errorMessage(err))
    }
  }

  return (
    <div className="space-y-4">
      {creating ? (
        <Card title="Add recruiter">
          <RecruiterForm
            isHead={isHead}
            onCancel={() => setCreating(false)}
            onSubmit={async (body) => {
              try {
                await registry.createRecruiter(body)
              } catch (err) {
                throw new Error(errorMessage(err))
              }
              setCreating(false)
              reload()
            }}
          />
        </Card>
      ) : (
        <Button onClick={() => setCreating(true)}>Add recruiter</Button>
      )}
      <ErrorAlert message={error} />
      {result?.recruiters.length === 0 && <p className="text-sm text-slate-600">No recruiters in the registry yet.</p>}
      {result?.recruiters.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-200 text-slate-500">
              <tr>
                <th className="py-2 pr-3 font-medium">Company</th>
                <th className="py-2 pr-3 font-medium">Domains</th>
                <th className="py-2 pr-3 font-medium">Status</th>
                <th className="py-2 pr-3 font-medium">Verified / expires</th>
                {isHead && <th className="py-2 font-medium">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {result.recruiters.map((recruiter) => (
                <tr key={recruiter.id} className={`align-top ${recruiter.isExpired || recruiter.status === 'suspended' ? 'text-slate-400' : ''}`}>
                  <td className="py-2 pr-3 font-medium">{recruiter.companyName}</td>
                  <td className="break-all py-2 pr-3 font-mono text-xs">{recruiter.domains.join(', ')}</td>
                  <td className="py-2 pr-3">
                    <RecruiterStatus recruiter={recruiter} />
                  </td>
                  <td className="py-2 pr-3 text-xs">
                    {day(recruiter.verification.verifiedAt)} → {day(recruiter.verification.expiresAt)}
                  </td>
                  {isHead && (
                    <td className="space-x-2 py-2 whitespace-nowrap">
                      {recruiter.status === 'pending_approval' && <Button onClick={() => approve(recruiter)}>Approve</Button>}
                      {recruiter.status === 'verified' && (
                        <Button
                          variant="secondary"
                          onClick={() =>
                            setAction({
                              kind: 'renew',
                              title: `Renew ${recruiter.companyName}`,
                              confirmLabel: 'Renew verification',
                              run: (verification) => registry.renewRecruiter(recruiter.id, verification),
                            })
                          }
                        >
                          Renew
                        </Button>
                      )}
                      {recruiter.status !== 'suspended' && (
                        <Button
                          variant="danger"
                          onClick={() =>
                            setAction({
                              kind: 'reason',
                              title: `Suspend ${recruiter.companyName}?`,
                              confirmLabel: 'Suspend',
                              run: (reason) => registry.suspendRecruiter(recruiter.id, reason),
                            })
                          }
                        >
                          Suspend
                        </Button>
                      )}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {action && (
        <ActionDialog
          action={action}
          onCancel={() => setAction(null)}
          onDone={() => {
            setAction(null)
            reload()
          }}
        />
      )}
    </div>
  )
}

function IndicatorsTab({ isHead }) {
  const [result, setResult] = useState(null)
  const [error, setError] = useState('')
  const [reloadKey, setReloadKey] = useState(0)
  const [action, setAction] = useState(null)

  useEffect(() => {
    let active = true
    registry
      .listIndicators({ limit: 100 })
      .then((data) => active && setResult(data))
      .catch((err) => active && setError(errorMessage(err, 'Could not load indicators.')))
    return () => {
      active = false
    }
  }, [reloadKey])

  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-600">Created only by TPO-head confirmed_fraud decisions; revoked automatically when the source cases are reopened.</p>
      <ErrorAlert message={error} />
      {result?.indicators.length === 0 && <p className="text-sm text-slate-600">No confirmed indicators yet.</p>}
      {result?.indicators.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-200 text-slate-500">
              <tr>
                <th className="py-2 pr-3 font-medium">Type</th>
                <th className="py-2 pr-3 font-medium">Value</th>
                <th className="py-2 pr-3 font-medium">Status</th>
                <th className="py-2 pr-3 font-medium">Source cases</th>
                <th className="py-2 pr-3 font-medium">Confirmed</th>
                {isHead && <th className="py-2 font-medium">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {result.indicators.map((indicator) => (
                <tr key={indicator.id} className={`align-top ${indicator.status === 'revoked' ? 'text-slate-400' : ''}`}>
                  <td className="py-2 pr-3">{INDICATOR_TYPE_LABELS[indicator.type] ?? indicator.type}</td>
                  <td className="break-all py-2 pr-3 font-mono text-xs">{indicator.value}</td>
                  <td className="py-2 pr-3">
                    {indicator.status === 'active' ? 'Active' : `Revoked${indicator.revokeReason === 'source_case_reopened' ? ' (case reopened)' : ''}`}
                  </td>
                  <td className="py-2 pr-3">
                    {indicator.sourceCases.map((item) => (
                      <Link key={item.id} to={`/staff/cases/${item.id}`} className="mr-2 font-mono text-xs text-blue-700 hover:underline">
                        {item.caseNumber ?? item.id}
                      </Link>
                    ))}
                  </td>
                  <td className="py-2 pr-3 text-xs">{day(indicator.lastConfirmedAt)}</td>
                  {isHead && (
                    <td className="py-2">
                      {indicator.status === 'active' && (
                        <Button
                          variant="danger"
                          onClick={() =>
                            setAction({ kind: 'reason', title: `Revoke ${indicator.value}?`, confirmLabel: 'Revoke', run: (reason) => registry.revokeIndicator(indicator.id, reason) })
                          }
                        >
                          Revoke
                        </Button>
                      )}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {action && (
        <ActionDialog
          action={action}
          onCancel={() => setAction(null)}
          onDone={() => {
            setAction(null)
            setReloadKey((key) => key + 1)
          }}
        />
      )}
    </div>
  )
}

export default function RegistryPage() {
  const { user } = useAuth()
  const isHead = user.role === ROLES.TPO_HEAD
  const [tab, setTab] = useState('recruiters')

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-slate-900">College registry</h1>
      <div role="tablist" aria-label="Registry" className="flex gap-2">
        {TABS.map((item) => (
          <button
            key={item.value}
            type="button"
            role="tab"
            aria-selected={tab === item.value}
            onClick={() => setTab(item.value)}
            className={`rounded-full px-3 py-1.5 text-sm font-medium ${tab === item.value ? 'bg-blue-700 text-white' : 'bg-white text-slate-700 ring-1 ring-slate-300'}`}
          >
            {item.label}
          </button>
        ))}
      </div>
      <Card>{tab === 'recruiters' ? <RecruitersTab isHead={isHead} /> : <IndicatorsTab isHead={isHead} />}</Card>
    </div>
  )
}
