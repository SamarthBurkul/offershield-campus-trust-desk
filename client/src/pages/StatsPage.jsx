import { useEffect, useState } from 'react'
import { errorMessage } from '../api/errors.js'
import { getStats } from '../api/stats.js'
import BarRows from '../components/BarRows.jsx'
import Skeleton from '../components/Skeleton.jsx'
import StatCard from '../components/StatCard.jsx'
import { Button, Card, ErrorAlert, TextField } from '../components/ui.jsx'
import { CHANNEL_LABELS, DECISION_TYPE_LABELS, STAFF_STATUS_LABELS } from '../constants/caseStatus.js'
import usePageTitle from '../hooks/usePageTitle.js'

const LOOKUP_LABELS = {
  confirmed_fraud: 'Confirmed fraud',
  lookalike_warning: 'Look-alike warning',
  verified: 'Verified recruiter',
  verified_expired: 'Verification expired',
  not_reviewed: 'Not reviewed',
}
const inr = (value) => `₹${Number(value ?? 0).toLocaleString('en-IN')}`
const toRows = (counts, labels) => Object.entries(counts ?? {}).map(([key, value]) => ({ label: labels[key] ?? key, value }))

export default function StatsPage() {
  usePageTitle('Statistics')
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

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-bold text-slate-900">Desk statistics</h1>
        <p className="text-sm text-slate-600">
          {stats ? `From ${new Date(stats.range.from).toLocaleDateString()} to ${new Date(stats.range.to).toLocaleDateString()}` : 'Last 90 days by default'}
        </p>
      </div>

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
          <Button type="submit">Apply</Button>
        </form>
      </Card>

      <ErrorAlert message={error} />
      {!stats && !error && <Skeleton rows={4} label="Loading statistics" />}
      {stats && (
        <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <StatCard label="Open cases" value={stats.cases.openCount} hint="Requests not yet decided (right now)." />
            <StatCard label="Stale open cases" value={stats.cases.staleOpenCount} hint="Open cases with no recent activity." />
            <StatCard label="Unassigned open" value={stats.cases.unassignedOpenCount} hint="Open cases nobody has picked up." />
            <StatCard
              label="Median hours to decision"
              value={stats.decisions.medianHoursToDecision ?? '–'}
              hint="From submission to the TPO head's decision, for decisions in range."
            />
            <StatCard label="Fee demands reported" value={stats.money.casesWithFeeRequested} hint="Requests where students were asked to pay." />
            <StatCard label="Money requested" value={inr(stats.money.totalAmountRequested)} hint="Total amount scammers asked for (where stated)." />
            <StatCard label="Students who had paid" value={stats.money.studentsReportedPaid} hint="Requests where the student had already paid." />
            <StatCard label="Linked cases" value={stats.relatedCaseLinks} hint="Requests connected to at least one similar request." />
            <StatCard label="Active fraud indicators" value={stats.registry.activeFraudIndicators} hint="Confirmed scam contacts students can check." />
            <StatCard
              label="Verified recruiters"
              value={stats.registry.verifiedRecruiters}
              hint={`${stats.registry.expiredRecruiters} expired · ${stats.registry.pendingRecruiters} pending approval.`}
            />
            <StatCard label="Advisories published" value={stats.advisories.publishedCount} hint="Live campus warnings." />
            <StatCard label="Advisory read rate" value={`${Math.round(stats.advisories.overallAckRate * 100)}%`} hint="Share of targeted students who confirmed reading." />
          </div>

          <Card>
            <div className="grid gap-6 md:grid-cols-2">
              <BarRows title="Requests by status" hint="Requests submitted in the selected range." rows={toRows(stats.cases.byStatus, STAFF_STATUS_LABELS)} />
              <BarRows title="Requests by channel" hint="Where the suspicious offer reached the student." rows={toRows(stats.cases.byChannel, CHANNEL_LABELS)} />
              <BarRows
                title="Requests per week"
                hint="Last 8 ISO weeks."
                rows={stats.cases.createdPerWeek.map((week) => ({ label: week.week, value: week.count }))}
              />
              <BarRows title="Decisions by outcome" hint="Decisions recorded in the selected range." rows={toRows(stats.decisions.byType, DECISION_TYPE_LABELS)} />
              <BarRows title="Lookups by result" hint="'Check before you pay' searches (the query text is never stored)." rows={toRows(stats.lookups, LOOKUP_LABELS)} />
            </div>
          </Card>
        </>
      )}
    </div>
  )
}
