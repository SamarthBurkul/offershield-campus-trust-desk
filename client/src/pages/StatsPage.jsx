import {
  Banknote,
  BadgeCheck,
  BellRing,
  CalendarRange,
  Clock3,
  HandCoins,
  Inbox,
  Link2,
  MailWarning,
  ShieldAlert,
  Timer,
  UserRoundX,
} from 'lucide-react'
import { useEffect, useState } from 'react'
import { errorMessage } from '../api/errors.js'
import { getStats } from '../api/stats.js'
import BarRows from '../components/BarRows.jsx'
import { Button, Card, ErrorAlert, PageHeader, Skeleton, StatCard, TextField } from '../components/ui/index.js'
import { CHANNEL_LABELS, DECISION_TYPE_LABELS, STAFF_STATUS_LABELS } from '../constants/caseStatus.js'
import usePageTitle from '../hooks/usePageTitle.js'
import { formatDate, formatMoney } from '../utils/format.js'

const LOOKUP_LABELS = {
  confirmed_fraud: 'Confirmed fraud',
  lookalike_warning: 'Look-alike warning',
  verified: 'Verified recruiter',
  verified_expired: 'Verification expired',
  not_reviewed: 'Not reviewed',
}
const toRows = (counts, labels) => Object.entries(counts ?? {}).map(([key, value]) => ({ label: labels[key] ?? key, value }))

const isoDay = (date) => date.toISOString().slice(0, 10)
const daysAgo = (days) => isoDay(new Date(Date.now() - days * 86_400_000))

// Presets only fill the existing from/to parameters; "90 days" is the server default (empty range).
const PRESETS = [
  { value: '7', label: '7 days', range: () => ({ from: daysAgo(7), to: isoDay(new Date()) }) },
  { value: '30', label: '30 days', range: () => ({ from: daysAgo(30), to: isoDay(new Date()) }) },
  { value: '90', label: '90 days', range: () => ({ from: '', to: '' }) },
  { value: 'custom', label: 'Custom' },
]

function Group({ title, description, children }) {
  return (
    <section className="space-y-3" aria-label={title}>
      <div>
        <h2 className="text-base font-semibold text-slate-900">{title}</h2>
        {description && <p className="text-sm text-slate-500">{description}</p>}
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">{children}</div>
    </section>
  )
}

export default function StatsPage() {
  usePageTitle('Statistics')
  const [preset, setPreset] = useState('90')
  const [draft, setDraft] = useState({ from: '', to: '' })
  const [range, setRange] = useState({ from: '', to: '' })
  const [stats, setStats] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    getStats(range)
      .then((data) => {
        if (!active) return
        setStats(data)
        setError('')
      })
      .catch((err) => active && setError(errorMessage(err, 'Could not load statistics.')))
    return () => {
      active = false
    }
  }, [range])

  function choose(value) {
    setPreset(value)
    const item = PRESETS.find((entry) => entry.value === value)
    if (item.range) setRange(item.range())
  }

  return (
    <div className="space-y-8">
      <PageHeader
        title="Desk statistics"
        description={stats ? `From ${formatDate(stats.range.from)} to ${formatDate(stats.range.to)}` : 'Last 90 days by default'}
        actions={
          <div role="group" aria-label="Date range" className="inline-flex rounded-xl bg-white p-1 shadow-sm ring-1 ring-slate-200">
            {PRESETS.map((item) => (
              <button
                key={item.value}
                type="button"
                aria-pressed={preset === item.value}
                onClick={() => choose(item.value)}
                className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${preset === item.value ? 'bg-brand-900 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100'}`}
              >
                {item.label}
              </button>
            ))}
          </div>
        }
      />

      {preset === 'custom' && (
        <Card>
          <form
            className="flex flex-wrap items-end gap-3"
            onSubmit={(event) => {
              event.preventDefault()
              setRange({ ...draft })
            }}
          >
            <TextField label="From" type="date" value={draft.from} onChange={(event) => setDraft((d) => ({ ...d, from: event.target.value }))} />
            <TextField label="To" type="date" value={draft.to} onChange={(event) => setDraft((d) => ({ ...d, to: event.target.value }))} />
            <Button type="submit" icon={CalendarRange}>
              Apply
            </Button>
          </form>
        </Card>
      )}

      <ErrorAlert message={error} />
      {!stats && !error && <Skeleton rows={4} label="Loading statistics" />}
      {stats && (
        <>
          <Group title="Cases" description="Workload right now and how fast decisions are made.">
            <StatCard icon={Inbox} label="Open cases" value={stats.cases.openCount} hint="Requests not yet decided (right now)." />
            <StatCard icon={Clock3} tone="warning" label="Stale open cases" value={stats.cases.staleOpenCount} hint="Open cases with no recent activity." />
            <StatCard icon={UserRoundX} tone="danger" label="Unassigned open" value={stats.cases.unassignedOpenCount} hint="Open cases nobody has picked up." />
            <StatCard
              icon={Timer}
              tone="accent"
              label="Median hours to decision"
              value={stats.decisions.medianHoursToDecision ?? '–'}
              hint="From submission to the TPO head's decision, for decisions in range."
            />
          </Group>

          <Group title="Money at risk" description="What scammers asked students for, as reported in requests.">
            <StatCard icon={HandCoins} tone="warning" label="Fee demands reported" value={stats.money.casesWithFeeRequested} hint="Requests where students were asked to pay." />
            <StatCard icon={Banknote} tone="danger" label="Money requested" value={formatMoney(stats.money.totalAmountRequested)} hint="Total amount scammers asked for (where stated)." />
            <StatCard icon={MailWarning} tone="danger" label="Students who had paid" value={stats.money.studentsReportedPaid} hint="Requests where the student had already paid." />
            <StatCard icon={Link2} tone="info" label="Linked cases" value={stats.relatedCaseLinks} hint="Requests connected to at least one similar request." />
          </Group>

          <Group title="Registry and awareness" description="What students can check, and whether warnings were read.">
            <StatCard icon={ShieldAlert} tone="danger" label="Active fraud indicators" value={stats.registry.activeFraudIndicators} hint="Confirmed scam contacts students can check." />
            <StatCard
              icon={BadgeCheck}
              tone="success"
              label="Verified recruiters"
              value={stats.registry.verifiedRecruiters}
              hint={`${stats.registry.expiredRecruiters} expired · ${stats.registry.pendingRecruiters} pending approval.`}
            />
            <StatCard icon={BellRing} tone="accent" label="Advisories published" value={stats.advisories.publishedCount} hint="Live campus warnings." />
            <StatCard
              icon={BellRing}
              tone="success"
              label="Advisory read rate"
              value={`${Math.round(stats.advisories.overallAckRate * 100)}%`}
              hint="Share of targeted students who confirmed reading."
            />
          </Group>

          <Card title="Breakdowns" description="Counts for the selected range.">
            <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
              <BarRows title="Requests by status" hint="Requests submitted in the selected range." rows={toRows(stats.cases.byStatus, STAFF_STATUS_LABELS)} />
              <BarRows title="Requests by channel" hint="Where the suspicious offer reached the student." rows={toRows(stats.cases.byChannel, CHANNEL_LABELS)} />
              <BarRows title="Requests per week" hint="Last 8 ISO weeks." rows={stats.cases.createdPerWeek.map((week) => ({ label: week.week, value: week.count }))} />
              <BarRows title="Decisions by outcome" hint="Decisions recorded in the selected range." rows={toRows(stats.decisions.byType, DECISION_TYPE_LABELS)} />
              <BarRows title="Lookups by result" hint="'Check before you pay' searches (the query text is never stored)." rows={toRows(stats.lookups, LOOKUP_LABELS)} />
            </div>
          </Card>
        </>
      )}
    </div>
  )
}
