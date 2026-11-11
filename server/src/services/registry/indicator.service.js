'use strict';

/**
 * Confirmed fraud indicator registry. Only decision.service (publish/revoke via these functions)
 * and the TPO head's manual revoke write FraudIndicator documents. There is deliberately no create API.
 */
const { isValidObjectId } = require('mongoose');
const AppError = require('../../utils/AppError');
const { fraudIndicatorRepository, recruiterRepository, caseRepository } = require('../../repositories');
const { normalizeDomain, normalizeEmail, normalizePhone, normalizeUpi, normalizeUrl } = require('../indicators/normalize');
const { ownerCandidates, indicatorDomain } = require('./domains');
const { refreshOpenCases } = require('../signals/loader');
const audit = require('../audit.service');
const { idOf } = require('../../utils/safeUser');

const iso = (date) => (date ? new Date(date).toISOString() : null);

/**
 * Throws 409 CONFLICTS_WITH_VERIFIED_RECRUITER if any indicator's domain (domain, email domain or
 * URL host) belongs to a verified recruiter of this college. Called BEFORE the decision is applied.
 */
async function assertNoVerifiedRecruiterConflict(collegeId, indicators) {
  for (const indicator of indicators) {
    const domain = indicatorDomain(indicator);
    if (!domain) continue;
    const owner = await recruiterRepository
      .forTenant(collegeId)
      .findOne({ status: 'verified', domains: { $in: ownerCandidates(domain) } }, { lean: true });
    if (owner) {
      const err = new AppError(
        409,
        'CONFLICTS_WITH_VERIFIED_RECRUITER',
        `${indicator.value} belongs to the verified recruiter "${owner.companyName}". Suspend that recruiter in the registry before confirming it as fraud.`,
      );
      err.details = { recruiterId: String(owner._id), companyName: owner.companyName, indicator: { type: indicator.type, value: indicator.value } };
      throw err;
    }
  }
}

async function upsertActive(collegeId, user, caseId, { type, value }, now) {
  const update = {
    $set: { status: 'active', lastConfirmedAt: now, revokedAt: null, revokedBy: null, revokeReason: null },
    $addToSet: { sourceCaseIds: caseId },
    $setOnInsert: { firstConfirmedAt: now, createdBy: user.id },
  };
  const repo = fraudIndicatorRepository.forTenant(collegeId);
  try {
    return await repo.findOneAndUpdate({ type, value }, update, { upsert: true });
  } catch (err) {
    // Two concurrent upserts of a new value: the loser retries as an update.
    if (err && err.code === 11000) return repo.findOneAndUpdate({ type, value }, update);
    throw err;
  }
}

/** On a confirmed_fraud decision (after the atomic update): publish each confirmed indicator. */
async function publishFromDecision(user, caseId, confirmedIndicators, { ip }) {
  const now = new Date();
  for (const indicator of confirmedIndicators) {
    const doc = await upsertActive(user.collegeId, user, caseId, indicator, now);
    await audit.record({
      collegeId: user.collegeId,
      actor: { id: user.id, role: user.role },
      action: 'indicator.publish',
      entityType: 'fraud_indicator',
      entityId: doc._id,
      metadata: { type: indicator.type, caseId: String(caseId) },
      ip,
    });
  }
  await refreshOpenCases(user.collegeId, confirmedIndicators);
}

/**
 * On reopen of a confirmed_fraud case: remove the case as a source; an indicator with no sources left
 * is revoked with reason "source_case_reopened".
 */
async function revokeForReopenedCase(user, caseId, confirmedIndicators, { ip }) {
  const repo = fraudIndicatorRepository.forTenant(user.collegeId);
  const now = new Date();
  for (const { type, value } of confirmedIndicators) {
    const after = await repo.findOneAndUpdate({ type, value, sourceCaseIds: caseId }, { $pull: { sourceCaseIds: caseId } });
    if (!after || after.sourceCaseIds.length > 0 || after.status !== 'active') continue;
    const revoked = await repo.findOneAndUpdate(
      { _id: after._id, status: 'active', sourceCaseIds: { $size: 0 } },
      { $set: { status: 'revoked', revokedAt: now, revokedBy: user.id, revokeReason: 'source_case_reopened' } },
    );
    if (revoked) {
      await audit.record({
        collegeId: user.collegeId,
        actor: { id: user.id, role: user.role },
        action: 'indicator.revoke',
        entityType: 'fraud_indicator',
        entityId: revoked._id,
        metadata: { type, caseId: String(caseId), reason: 'source_case_reopened' },
        ip,
      });
    }
  }
  await refreshOpenCases(user.collegeId, confirmedIndicators);
}

/** TPO head revokes an indicator by hand. The free-text reason is stored on the indicator, not in the audit log. */
async function revokeManually(user, indicatorId, { reason }, { ip }) {
  if (!isValidObjectId(indicatorId)) throw new AppError(404, 'NOT_FOUND', 'Indicator not found');
  const repo = fraudIndicatorRepository.forTenant(user.collegeId);
  const existing = await repo.findById(indicatorId, { lean: true });
  if (!existing) throw new AppError(404, 'NOT_FOUND', 'Indicator not found');
  const revoked = await repo.findOneAndUpdate(
    { _id: existing._id, status: 'active' },
    { $set: { status: 'revoked', revokedAt: new Date(), revokedBy: user.id, revokeReason: reason } },
  );
  if (!revoked) throw new AppError(409, 'ALREADY_REVOKED', 'This indicator is already revoked');
  await audit.record({
    collegeId: user.collegeId,
    actor: { id: user.id, role: user.role },
    action: 'indicator.revoke',
    entityType: 'fraud_indicator',
    entityId: revoked._id,
    metadata: { type: revoked.type, reason: 'manual', reasonLength: reason.length },
    ip,
  });
  await refreshOpenCases(user.collegeId, [{ type: revoked.type, value: revoked.value }]);
  return revoked;
}

const NORMALIZERS = {
  email: (q) => normalizeEmail(q)?.email,
  domain: normalizeDomain,
  phone: normalizePhone,
  upi: normalizeUpi,
  url: (q) => normalizeUrl(q)?.url,
};

/** Staff list, with source case numbers. */
async function listIndicators(user, { type, status, q, page, limit }) {
  const filter = {};
  if (type) filter.type = type;
  if (status) filter.status = status;
  if (q) {
    const values = new Set([q.trim().toLowerCase()]);
    for (const normalize of Object.values(NORMALIZERS)) {
      const value = normalize(q);
      if (value) values.add(value);
    }
    filter.value = { $in: [...values] };
  }
  const repo = fraudIndicatorRepository.forTenant(user.collegeId);
  const [items, total] = await Promise.all([
    repo.find(filter, { sort: { lastConfirmedAt: -1, _id: -1 }, skip: (page - 1) * limit, limit, lean: true }),
    repo.count(filter),
  ]);
  const caseIds = [...new Set(items.flatMap((item) => item.sourceCaseIds.map(String)))];
  const cases = caseIds.length
    ? await caseRepository.forTenant(user.collegeId).find({ _id: { $in: caseIds } }, { select: 'caseNumber', lean: true })
    : [];
  const numbers = new Map(cases.map((item) => [String(item._id), item.caseNumber]));
  return {
    indicators: items.map((item) => ({
      id: idOf(item._id),
      type: item.type,
      value: item.value,
      status: item.status,
      sourceCases: item.sourceCaseIds.map((id) => ({ id: String(id), caseNumber: numbers.get(String(id)) ?? null })),
      firstConfirmedAt: iso(item.firstConfirmedAt),
      lastConfirmedAt: iso(item.lastConfirmedAt),
      revokedAt: iso(item.revokedAt),
      revokeReason: item.revokeReason ?? null,
    })),
    page,
    limit,
    total,
  };
}

module.exports = { assertNoVerifiedRecruiterConflict, publishFromDecision, revokeForReopenedCase, revokeManually, listIndicators };
