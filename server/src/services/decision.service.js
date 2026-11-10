'use strict';

const { isValidObjectId } = require('mongoose');
const AppError = require('../utils/AppError');
const { caseRepository } = require('../repositories');
const { normalizeDomain, normalizeEmail, normalizePhone, normalizeUpi, normalizeUrl } = require('./indicators/normalize');
const { findCaseOr404, transition, addEvent, recordAudit } = require('./staffCase.service');

const NORMALIZERS = {
  email: (value) => normalizeEmail(value)?.email,
  domain: normalizeDomain,
  phone: normalizePhone,
  upi: normalizeUpi,
  url: (value) => normalizeUrl(value)?.url,
};

const notOnCase = (what) => new AppError(400, 'INDICATOR_NOT_ON_CASE', `${what} must be one of this case's indicators`);

const normalize = (type, value) => NORMALIZERS[type](value) ?? value.trim().toLowerCase();

function hasIndicator(found, type, value) {
  return found.indicators.some((item) => item.type === type && item.value === value);
}

/** Confirmed indicators must exactly match (type + normalised value) indicators already on the case. */
function resolveConfirmedIndicators(found, requested) {
  const resolved = [];
  for (const { type, value } of requested) {
    const normalized = normalize(type, value);
    if (!hasIndicator(found, type, normalized)) throw notOnCase('Each confirmed indicator');
    if (!resolved.some((item) => item.type === type && item.value === normalized)) resolved.push({ type, value: normalized });
  }
  return resolved;
}

function resolveVerifiedDomains(found, requested) {
  const resolved = new Set();
  for (const value of requested) {
    const domain = normalize('domain', value);
    if (!hasIndicator(found, 'domain', domain)) throw notOnCase('Each verified domain');
    resolved.add(domain);
  }
  return [...resolved];
}

async function resolveDuplicate(user, found, duplicateOfCaseId) {
  if (!duplicateOfCaseId) return null;
  if (String(found._id) === duplicateOfCaseId) {
    throw new AppError(400, 'VALIDATION_ERROR', 'Invalid request: duplicateOfCaseId: must be a different case');
  }
  // Another college's case is indistinguishable from a missing one.
  const original = isValidObjectId(duplicateOfCaseId)
    ? await caseRepository.forTenant(user.collegeId).findById(duplicateOfCaseId, { lean: true })
    : null;
  if (!original) throw new AppError(404, 'NOT_FOUND', 'The case it duplicates was not found');
  return original._id;
}

/**
 * Record the final decision (TPO head only). One atomic conditional update moves the case from any
 * open status to the decision's final status; concurrent decisions therefore cannot both succeed.
 *
 * Registry entries are NOT created here. Phase 5 builds the college registry from
 * decision.confirmedIndicators and decision.verifiedDomains.
 */
async function recordDecision(user, caseId, input, { ip }) {
  const found = await findCaseOr404(user, caseId);
  const now = new Date();
  const decision = {
    type: input.type,
    basis: input.basis,
    checks: [...new Set(input.checks)],
    studentMessage: input.studentMessage,
    confirmedIndicators: resolveConfirmedIndicators(found, input.confirmedIndicators),
    verifiedDomains: resolveVerifiedDomains(found, input.verifiedDomains),
    dismissReason: input.dismissReason ?? null,
    duplicateOfCaseId: await resolveDuplicate(user, found, input.duplicateOfCaseId),
    decidedBy: user.id,
    decidedAt: now,
  };

  const before = await transition(user, found._id, 'decision', input.type, { set: { decision } });

  await addEvent(user, found._id, {
    type: 'decision_recorded',
    body: input.studentMessage,
    visibleToStudent: true,
    metadata: { type: input.type },
  });
  await addEvent(user, found._id, {
    type: 'status_changed',
    body: 'Your placement cell has recorded an outcome for this request.',
    visibleToStudent: true,
    metadata: { from: before.status, to: input.type },
  });
  // The basis text and student message stay out of the audit log.
  await recordAudit(
    user,
    found._id,
    'case.decision',
    {
      type: input.type,
      checks: decision.checks,
      confirmedIndicatorCount: decision.confirmedIndicators.length,
      verifiedDomainCount: decision.verifiedDomains.length,
      dismissReason: decision.dismissReason,
    },
    ip,
  );
}

/**
 * Reopen a closed case (TPO head only): the current decision moves to decisionHistory with the reason.
 * Phase 5 must also revoke any registry entries created from the reopened decision.
 */
async function reopenCase(user, caseId, { reason }, { ip }) {
  const found = await findCaseOr404(user, caseId);
  const previous = found.decision ? found.decision.toObject() : null;
  const now = new Date();

  // Matching the current decidedAt guards against a concurrent reopen/decision in between.
  const before = await transition(user, found._id, 'reopen', 'under_review', {
    filter: previous ? { 'decision.decidedAt': previous.decidedAt } : { decision: null },
    set: { decision: null },
    push: previous ? { decisionHistory: { ...previous, reopenedBy: user.id, reopenedAt: now, reopenReason: reason } } : undefined,
  });

  await addEvent(user, found._id, {
    type: 'reopened',
    body: 'Your request has been reopened for further review.',
    visibleToStudent: true,
    // Staff-only: student serializers never include event metadata.
    metadata: { reason, previousStatus: before.status },
  });
  await recordAudit(user, found._id, 'case.reopen', { previousStatus: before.status, previousDecisionType: previous?.type ?? null }, ip);
}

module.exports = { recordDecision, reopenCase };
