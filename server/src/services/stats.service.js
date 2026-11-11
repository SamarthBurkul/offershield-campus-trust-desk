'use strict';

/**
 * College statistics for staff. Every aggregation goes through tenantRepository.aggregate, which
 * prepends { $match: { collegeId } } and refuses cross-collection stages.
 */
const {
  caseRepository,
  fraudIndicatorRepository,
  recruiterRepository,
  lookupEventRepository,
  advisoryRepository,
  acknowledgementRepository,
} = require('../repositories');
const { OPEN_STATUSES, CASE_STATUSES, CHANNELS, DECISION_TYPES } = require('../constants/caseStatus');

const DAY_MS = 86_400_000;
const WEEK_MS = 7 * DAY_MS;
const WEEKS = 8;
const LOOKUP_RESULTS = ['confirmed_fraud', 'lookalike_warning', 'verified', 'verified_expired', 'not_reviewed'];

/** { key: count } with every expected key present (0 when absent). */
const toCounts = (rows, keys) => Object.fromEntries(keys.map((key) => [key, rows.find((row) => row._id === key)?.count ?? 0]));

function median(values) {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  const value = sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
  return Math.round(value * 10) / 10;
}

/** Monday 00:00 UTC of the ISO week containing `date`. */
function isoWeekStart(date) {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() - (day - 1));
  return d;
}

/** ISO week label such as "2026-W46" (ISO week-numbering year). */
function isoWeekLabel(weekStart) {
  const thursday = new Date(weekStart.getTime() + 3 * DAY_MS);
  const yearStart = new Date(Date.UTC(thursday.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((thursday - yearStart) / DAY_MS + 1) / 7);
  return `${thursday.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}

async function getStats(user, { from, to }, { staleDays }) {
  const collegeId = user.collegeId;
  const now = new Date();
  const rangeTo = to ?? now;
  const rangeFrom = from ?? new Date(rangeTo.getTime() - 90 * DAY_MS);
  const created = { createdAt: { $gte: rangeFrom, $lte: rangeTo } };
  const cases = caseRepository.forTenant(collegeId);

  const firstWeek = new Date(isoWeekStart(rangeTo).getTime() - (WEEKS - 1) * WEEK_MS);
  const open = { status: { $in: OPEN_STATUSES } };

  const [byStatus, byChannel, perWeek, openCount, staleOpenCount, unassignedOpenCount, decided, money, relatedCaseLinks] = await Promise.all([
    cases.aggregate([{ $match: created }, { $group: { _id: '$status', count: { $sum: 1 } } }]),
    cases.aggregate([{ $match: created }, { $group: { _id: '$channel', count: { $sum: 1 } } }]),
    cases.aggregate([
      { $match: { createdAt: { $gte: firstWeek, $lte: rangeTo } } },
      { $group: { _id: { $dateTrunc: { date: '$createdAt', unit: 'week', startOfWeek: 'monday', timezone: 'UTC' } }, count: { $sum: 1 } } },
    ]),
    cases.count(open),
    cases.count({ ...open, lastActivityAt: { $lt: new Date(now.getTime() - staleDays * DAY_MS) } }),
    cases.count({ ...open, assigneeId: null }),
    cases.aggregate([
      { $match: { 'decision.decidedAt': { $gte: rangeFrom, $lte: rangeTo } } },
      { $project: { type: '$decision.type', hours: { $divide: [{ $subtract: ['$decision.decidedAt', '$createdAt'] }, 3_600_000] } } },
    ]),
    cases.aggregate([
      { $match: created },
      {
        $group: {
          _id: null,
          casesWithFeeRequested: { $sum: { $cond: ['$moneyRequested.requested', 1, 0] } },
          totalAmountRequested: { $sum: { $cond: [{ $and: ['$moneyRequested.requested', { $gt: ['$moneyRequested.amount', null] }] }, '$moneyRequested.amount', 0] } },
          studentsReportedPaid: { $sum: { $cond: ['$paidAlready', 1, 0] } },
        },
      },
    ]),
    cases.count({ ...created, 'linkedCaseIds.0': { $exists: true } }),
  ]);

  const recruiters = recruiterRepository.forTenant(collegeId);
  const [activeFraudIndicators, verifiedRecruiters, expiredRecruiters, pendingRecruiters, lookups, published] = await Promise.all([
    fraudIndicatorRepository.forTenant(collegeId).count({ status: 'active' }),
    recruiters.count({ status: 'verified', 'verification.expiresAt': { $gte: now } }),
    recruiters.count({ status: 'verified', 'verification.expiresAt': { $lt: now } }),
    recruiters.count({ status: 'pending_approval' }),
    lookupEventRepository.forTenant(collegeId).aggregate([{ $match: created }, { $group: { _id: '$resultStatus', count: { $sum: 1 } } }]),
    advisoryRepository.forTenant(collegeId).find({ status: 'published' }, { select: '_id audienceCountAtPublish', lean: true }),
  ]);
  const acknowledgements = published.length
    ? await acknowledgementRepository.forTenant(collegeId).count({ advisoryId: { $in: published.map((item) => item._id) } })
    : 0;
  const audience = published.reduce((sum, item) => sum + (item.audienceCountAtPublish ?? 0), 0);

  const weekCounts = new Map(perWeek.map((row) => [new Date(row._id).getTime(), row.count]));
  const createdPerWeek = Array.from({ length: WEEKS }, (_, i) => {
    const start = new Date(firstWeek.getTime() + i * WEEK_MS);
    return { week: isoWeekLabel(start), weekStart: start.toISOString().slice(0, 10), count: weekCounts.get(start.getTime()) ?? 0 };
  });
  const decisionTypes = Object.fromEntries(DECISION_TYPES.map((type) => [type, decided.filter((row) => row.type === type).length]));
  const totals = money[0] ?? { casesWithFeeRequested: 0, totalAmountRequested: 0, studentsReportedPaid: 0 };

  return {
    range: { from: rangeFrom.toISOString(), to: rangeTo.toISOString() },
    cases: {
      byStatus: toCounts(byStatus, CASE_STATUSES),
      byChannel: toCounts(byChannel, CHANNELS),
      createdPerWeek,
      openCount,
      staleOpenCount,
      unassignedOpenCount,
    },
    decisions: {
      byType: decisionTypes,
      medianHoursToDecision: median(decided.map((row) => row.hours)),
    },
    money: {
      casesWithFeeRequested: totals.casesWithFeeRequested,
      totalAmountRequested: totals.totalAmountRequested,
      studentsReportedPaid: totals.studentsReportedPaid,
    },
    registry: { activeFraudIndicators, verifiedRecruiters, expiredRecruiters, pendingRecruiters },
    lookups: toCounts(lookups, LOOKUP_RESULTS),
    advisories: { publishedCount: published.length, overallAckRate: audience ? Math.round((acknowledgements / audience) * 1000) / 1000 : 0 },
    relatedCaseLinks,
  };
}

module.exports = { getStats, median, isoWeekLabel, isoWeekStart };
