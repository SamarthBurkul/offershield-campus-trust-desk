import { AtSign, BadgeCheck, Ban, CheckCircle2, Globe, Link2, MoreHorizontal, Phone, Plus, RefreshCcw, ShieldAlert, Wallet } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { errorMessage } from '../api/errors.js'
import * as registry from '../api/registry.js'
import { ROLES } from '../auth/roles.js'
import { useAuth } from '../auth/useAuth.js'
import ConfirmDialog from '../components/ConfirmDialog.jsx'
import RecruiterForm from '../components/RecruiterForm.jsx'
import {
  Badge,
  Button,
  Card,
  CheckboxField,
  CodeChip,
  Drawer,
  DropdownMenu,
  EmptyState,
  ErrorAlert,
  PageHeader,
  Skeleton,
  Table,
  Tabs,
  TBody,
  Td,
  TextAreaField,
  Th,
  THead,
  Tr,
  useToast,
} from '../components/ui/index.js'
import { INDICATOR_TYPE_LABELS } from '../constants/caseStatus.js'
import { RECRUITER_STATUS_LABELS, VERIFICATION_METHOD_LABELS } from '../constants/verificationMethods.js'
import usePageTitle from '../hooks/usePageTitle.js'
import { formatDate } from '../utils/format.js'

const TABS = [
  { value: 'recruiters', label: 'Recruiters', icon: BadgeCheck },
  { value: 'indicators', label: 'Confirmed indicators', icon: ShieldAlert },
]
const TYPE_ICONS = { domain: Globe, url: Link2, email: AtSign, phone: Phone, upi: Wallet }
const toggle = (list, value) => (list.includes(value) ? list.filter((item) => item !== value) : [...list, value])

function RecruiterStatus({ recruiter }) {
  if (recruiter.isExpired) return <Badge tone="neutral">Expired</Badge>
  const tones = { pending_approval: 'warning', verified: 'success', suspended: 'neutral' }
  return (
    <Badge tone={tones[recruiter.status] ?? 'neutral'} dot>
      {RECRUITER_STATUS_LABELS[recruiter.status]}
    </Badge>
  )
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
      onDone(action)
    } catch (err) {
      setError(errorMessage(err))
      setBusy(false)
    }
  }

  return (
    <ConfirmDialog title={action.title} confirmLabel={action.confirmLabel} danger={!isRenew} busy={busy} onConfirm={confirm} onCancel={onCancel}>
      {isRenew && (
        <fieldset className="space-y-1.5">
          <legend className="mb-1 font-medium text-slate-800">Verification methods</legend>
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
  const toast = useToast()
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
      toast.success(`${recruiter.companyName} is now verified.`)
      reload()
    } catch (err) {
      setError(errorMessage(err))
    }
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
        <p className="text-sm text-slate-600">Companies your placement cell verified, with their official domains and verification window.</p>
        <Button icon={Plus} onClick={() => setCreating(true)}>
          Add recruiter
        </Button>
      </div>
      <div className="px-5 empty:hidden">
        <ErrorAlert message={error} />
        {!result && !error && <Skeleton rows={3} label="Loading recruiters" />}
        {result?.recruiters.length === 0 && <EmptyState icon={BadgeCheck} title="No recruiters in the registry yet." className="mb-5" />}
      </div>
      {result?.recruiters.length > 0 && (
        <Table label="Recruiters">
          <THead>
            <tr>
              <Th>Company</Th>
              <Th>Domains</Th>
              <Th>Status</Th>
              <Th>Verified → expires</Th>
              {isHead && <Th className="text-right">Actions</Th>}
            </tr>
          </THead>
          <TBody>
            {result.recruiters.map((recruiter) => {
              const muted = recruiter.isExpired || recruiter.status === 'suspended'
              return (
                <Tr key={recruiter.id} muted={muted}>
                  <Td className={muted ? 'font-medium' : 'font-medium text-slate-900'}>{recruiter.companyName}</Td>
                  <Td>
                    <div className="flex flex-wrap gap-1.5">
                      {recruiter.domains.map((domain) => (
                        <CodeChip key={domain} className={muted ? 'opacity-60' : undefined}>
                          {domain}
                        </CodeChip>
                      ))}
                    </div>
                  </Td>
                  <Td>
                    <RecruiterStatus recruiter={recruiter} />
                  </Td>
                  <Td className="whitespace-nowrap text-xs tabular-nums">
                    {formatDate(recruiter.verification.verifiedAt)} → {formatDate(recruiter.verification.expiresAt)}
                  </Td>
                  {isHead && (
                    <Td className="whitespace-nowrap text-right">
                      <div className="inline-flex items-center gap-2">
                        {recruiter.status === 'pending_approval' && (
                          <Button size="sm" variant="success" icon={CheckCircle2} onClick={() => approve(recruiter)}>
                            Approve
                          </Button>
                        )}
                        {recruiter.status !== 'suspended' && (
                          <DropdownMenu
                            label={`Actions for ${recruiter.companyName}`}
                            buttonClassName="h-8 w-8 justify-center text-slate-500 hover:bg-slate-100 hover:text-slate-800"
                            trigger={<MoreHorizontal className="h-4 w-4" aria-hidden="true" />}
                            items={[
                              recruiter.status === 'verified' && {
                                label: 'Renew',
                                icon: RefreshCcw,
                                onSelect: () =>
                                  setAction({
                                    kind: 'renew',
                                    title: `Renew ${recruiter.companyName}`,
                                    confirmLabel: 'Renew verification',
                                    done: `${recruiter.companyName} verification renewed.`,
                                    run: (verification) => registry.renewRecruiter(recruiter.id, verification),
                                  }),
                              },
                              {
                                label: 'Suspend',
                                icon: Ban,
                                tone: 'danger',
                                onSelect: () =>
                                  setAction({
                                    kind: 'reason',
                                    title: `Suspend ${recruiter.companyName}?`,
                                    confirmLabel: 'Suspend',
                                    done: `${recruiter.companyName} was suspended.`,
                                    run: (reason) => registry.suspendRecruiter(recruiter.id, reason),
                                  }),
                              },
                            ]}
                          />
                        )}
                      </div>
                    </Td>
                  )}
                </Tr>
              )
            })}
          </TBody>
        </Table>
      )}
      {creating && (
        <Drawer
          title="Add recruiter"
          description={isHead ? 'Saved as a verified recruiter.' : 'Your TPO head approves it before students see it as verified.'}
          onClose={() => setCreating(false)}
        >
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
              toast.success(`${body.companyName} was added to the registry.`)
              reload()
            }}
          />
        </Drawer>
      )}
      {action && (
        <ActionDialog
          action={action}
          onCancel={() => setAction(null)}
          onDone={(done) => {
            setAction(null)
            toast.success(done.done)
            reload()
          }}
        />
      )}
    </div>
  )
}

function IndicatorsTab({ isHead }) {
  const toast = useToast()
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
    <div>
      <p className="px-5 py-4 text-sm text-slate-600">
        Created only by TPO-head confirmed_fraud decisions; revoked automatically when the source cases are reopened.
      </p>
      <div className="px-5 empty:hidden">
        <ErrorAlert message={error} />
        {!result && !error && <Skeleton rows={3} label="Loading indicators" />}
        {result?.indicators.length === 0 && (
          <EmptyState icon={ShieldAlert} title="No confirmed indicators yet." className="mb-5">
            They appear when the TPO head confirms a fraud case.
          </EmptyState>
        )}
      </div>
      {result?.indicators.length > 0 && (
        <Table label="Confirmed indicators">
          <THead>
            <tr>
              <Th>Type</Th>
              <Th>Value</Th>
              <Th>Status</Th>
              <Th>Source cases</Th>
              <Th>Confirmed</Th>
              {isHead && <Th className="text-right">Actions</Th>}
            </tr>
          </THead>
          <TBody>
            {result.indicators.map((indicator) => {
              const Icon = TYPE_ICONS[indicator.type] ?? Globe
              const revoked = indicator.status === 'revoked'
              return (
                <Tr key={indicator.id} muted={revoked}>
                  <Td className="whitespace-nowrap">
                    <span className="inline-flex items-center gap-2">
                      <Icon className="h-4 w-4 text-slate-400" aria-hidden="true" />
                      {INDICATOR_TYPE_LABELS[indicator.type] ?? indicator.type}
                    </span>
                  </Td>
                  <Td>
                    <CodeChip tone={revoked ? 'neutral' : 'danger'}>{indicator.value}</CodeChip>
                  </Td>
                  <Td>
                    {revoked ? (
                      <Badge tone="neutral">Revoked{indicator.revokeReason === 'source_case_reopened' ? ' (case reopened)' : ''}</Badge>
                    ) : (
                      <Badge tone="danger" dot>
                        Active
                      </Badge>
                    )}
                  </Td>
                  <Td>
                    <div className="flex flex-wrap gap-2">
                      {indicator.sourceCases.map((item) => (
                        <Link key={item.id} to={`/staff/cases/${item.id}`} className="font-mono text-xs font-medium text-accent-700 hover:underline">
                          {item.caseNumber ?? item.id}
                        </Link>
                      ))}
                    </div>
                  </Td>
                  <Td className="whitespace-nowrap text-xs tabular-nums">{formatDate(indicator.lastConfirmedAt)}</Td>
                  {isHead && (
                    <Td className="text-right">
                      {!revoked && (
                        <Button
                          variant="ghost"
                          size="sm"
                          icon={Ban}
                          className="text-rose-700! hover:bg-rose-50! hover:text-rose-800!"
                          onClick={() =>
                            setAction({
                              kind: 'reason',
                              title: `Revoke ${indicator.value}?`,
                              confirmLabel: 'Revoke',
                              done: `${indicator.value} was revoked.`,
                              run: (reason) => registry.revokeIndicator(indicator.id, reason),
                            })
                          }
                        >
                          Revoke
                        </Button>
                      )}
                    </Td>
                  )}
                </Tr>
              )
            })}
          </TBody>
        </Table>
      )}
      {action && (
        <ActionDialog
          action={action}
          onCancel={() => setAction(null)}
          onDone={(done) => {
            setAction(null)
            toast.success(done.done)
            setReloadKey((key) => key + 1)
          }}
        />
      )}
    </div>
  )
}

export default function RegistryPage() {
  usePageTitle('Registry')
  const { user } = useAuth()
  const isHead = user.role === ROLES.TPO_HEAD
  const [tab, setTab] = useState('recruiters')

  return (
    <div className="space-y-6">
      <PageHeader
        title="College registry"
        description="What students see when they check before they pay: verified recruiters and contacts confirmed as fraud by your TPO head."
      />
      <Card padded={false}>
        <div className="px-5 pt-2">
          <Tabs label="Registry" value={tab} onChange={setTab} tabs={TABS} />
        </div>
        {tab === 'recruiters' ? <RecruitersTab isHead={isHead} /> : <IndicatorsTab isHead={isHead} />}
      </Card>
    </div>
  )
}
