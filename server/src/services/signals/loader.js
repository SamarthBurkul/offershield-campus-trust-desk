'use strict';

const { caseRepository, fraudIndicatorRepository, recruiterRepository } = require('../../repositories');
const { OPEN_STATUSES } = require('../../constants/caseStatus');
const { computeSignals } = require('./compute');

const MAX_RECOMPUTE = 500;

/** The registry inputs for signal computation, for one college. */
async function loadRegistry(collegeId) {
  const [activeIndicators, verifiedRecruiters] = await Promise.all([
    fraudIndicatorRepository.forTenant(collegeId).find({ status: 'active' }, { select: 'type value', lean: true }),
    recruiterRepository.forTenant(collegeId).find({ status: 'verified' }, { select: 'companyName domains', lean: true }),
  ]);
  return { activeIndicators, verifiedRecruiters };
}

async function storeSignals(collegeId, caseDoc, registry) {
  const signals = computeSignals(caseDoc, registry);
  // Only signals and their timestamp change: never status, priority or anything student-visible.
  await caseRepository
    .forTenant(collegeId)
    .updateOne({ _id: caseDoc._id }, { $set: { signals, signalsComputedAt: new Date() } });
  return signals;
}

/** Recompute and store signals for one case. */
async function refreshCaseSignals(collegeId, caseId) {
  const caseDoc = await caseRepository.forTenant(collegeId).findById(caseId, { lean: true });
  if (!caseDoc) return null;
  return storeSignals(collegeId, caseDoc, await loadRegistry(collegeId));
}

/** After registry changes: recompute OPEN cases carrying any of the given indicators (or all open cases). */
async function refreshOpenCases(collegeId, indicators = null) {
  const filter = { status: { $in: OPEN_STATUSES } };
  if (indicators) {
    if (indicators.length === 0) return 0;
    filter.$or = indicators.map(({ type, value }) => ({ indicators: { $elemMatch: { type, value } } }));
  }
  const cases = await caseRepository
    .forTenant(collegeId)
    .find(filter, { sort: { lastActivityAt: -1 }, limit: MAX_RECOMPUTE, lean: true });
  if (cases.length === 0) return 0;
  const registry = await loadRegistry(collegeId);
  for (const caseDoc of cases) await storeSignals(collegeId, caseDoc, registry);
  return cases.length;
}

module.exports = { loadRegistry, refreshCaseSignals, refreshOpenCases };
