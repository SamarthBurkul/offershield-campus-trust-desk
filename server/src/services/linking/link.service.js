'use strict';

/**
 * Related-case linking inside ONE college: automatic (shared indicators, near-duplicate text) and
 * manual. Links are mirrored on both cases (`related` + `linkedCaseIds`) and are staff-only.
 */
const { isValidObjectId } = require('mongoose');
const AppError = require('../../utils/AppError');
const { caseRepository, caseEventRepository, recruiterRepository } = require('../../repositories');
const { ownerCandidates, indicatorDomain } = require('../registry/domains');
const { hamming, isComparable } = require('./simhash');
const audit = require('../audit.service');

const SIMILAR_TEXT_WINDOW_DAYS = 180;
const SIMILAR_TEXT_MAX_CANDIDATES = 1000;
const SHARED_INDICATOR_MAX_CANDIDATES = 200;

/** Indicators that may link cases: not those pointing at a verified recruiter's domain. */
async function linkableIndicators(collegeId, indicators) {
  const verified = await recruiterRepository.forTenant(collegeId).find({ status: 'verified' }, { select: 'domains', lean: true });
  const verifiedDomains = new Set(verified.flatMap((recruiter) => recruiter.domains));
  return indicators
    .map(({ type, value }) => ({ type, value }))
    .filter((indicator) => {
      const domain = indicatorDomain(indicator);
      return !domain || !ownerCandidates(domain).some((candidate) => verifiedDomains.has(candidate));
    });
}

/**
 * Record (or extend) a link on `caseId` pointing at `otherId`. Returns true if the link is new.
 * Existing links get their reasons/shared indicators merged in place.
 */
async function upsertLink(collegeId, caseId, otherId, { reasons, sharedIndicators = [], similarity = null, linkedBy = null }) {
  const cases = caseRepository.forTenant(collegeId);
  const merged = await cases.updateOne(
    { _id: caseId, 'related.caseId': otherId },
    {
      $addToSet: { 'related.$.reasons': { $each: reasons }, 'related.$.sharedIndicators': { $each: sharedIndicators } },
      ...(similarity !== null ? { $max: { 'related.$.similarity': similarity } } : {}),
    },
  );
  if (merged.matchedCount > 0) return false;
  const added = await cases.updateOne(
    { _id: caseId, 'related.caseId': { $ne: otherId } },
    {
      $push: { related: { caseId: otherId, reasons, sharedIndicators, similarity, linkedBy, detectedAt: new Date() } },
      $addToSet: { linkedCaseIds: otherId },
    },
  );
  return added.modifiedCount > 0;
}

async function linkPair(collegeId, a, b, details, actor = null) {
  const newOnA = await upsertLink(collegeId, a._id, b._id, details);
  const newOnB = await upsertLink(collegeId, b._id, a._id, details);
  const events = caseEventRepository.forTenant(collegeId);
  // Staff-only timeline entries.
  for (const [self, other, isNew] of [[a, b, newOnA], [b, a, newOnB]]) {
    if (!isNew) continue;
    await events.create({
      caseId: self._id,
      type: 'linked',
      actorId: actor?.id ?? null,
      actorRole: actor?.role ?? null,
      visibleToStudent: false,
      metadata: { action: 'link', otherCaseId: String(other._id), otherCaseNumber: other.caseNumber, reasons: details.reasons },
    });
  }
}

/**
 * Called after a case is created or a student replies: link it to other cases of the same college
 * that share a (linkable) indicator or have near-identical message text.
 */
async function detectLinks(collegeId, caseId, { maxDistance }) {
  const cases = caseRepository.forTenant(collegeId);
  const current = await cases.findById(caseId, { lean: true });
  if (!current) return;
  const found = new Map();
  const note = (other, patch) => {
    const entry = found.get(String(other._id)) ?? { other, reasons: new Set(), sharedIndicators: [], similarity: null };
    patch(entry);
    found.set(String(other._id), entry);
  };

  const indicators = await linkableIndicators(collegeId, current.indicators ?? []);
  if (indicators.length) {
    const sharing = await cases.find(
      { _id: { $ne: current._id }, $or: indicators.map(({ type, value }) => ({ indicators: { $elemMatch: { type, value } } })) },
      { select: 'caseNumber indicators', sort: { createdAt: -1 }, limit: SHARED_INDICATOR_MAX_CANDIDATES, lean: true },
    );
    for (const other of sharing) {
      const otherKeys = new Set(other.indicators.map((item) => `${item.type}:${item.value}`));
      const shared = indicators.filter((item) => otherKeys.has(`${item.type}:${item.value}`));
      note(other, (entry) => {
        entry.reasons.add('shared_indicator');
        entry.sharedIndicators.push(...shared);
      });
    }
  }

  if (current.textHash && isComparable(current.messageText)) {
    const since = new Date(Date.now() - SIMILAR_TEXT_WINDOW_DAYS * 86_400_000);
    const recent = await cases.find(
      { _id: { $ne: current._id }, createdAt: { $gte: since }, textHash: { $ne: null } },
      { select: 'caseNumber textHash messageText', sort: { createdAt: -1 }, limit: SIMILAR_TEXT_MAX_CANDIDATES, lean: true },
    );
    for (const other of recent) {
      const distance = hamming(current.textHash, other.textHash);
      if (distance <= maxDistance && isComparable(other.messageText)) {
        note(other, (entry) => {
          entry.reasons.add('similar_text');
          entry.similarity = Math.round(((64 - distance) / 64) * 100) / 100;
        });
      }
    }
  }

  for (const { other, reasons, sharedIndicators, similarity } of found.values()) {
    await linkPair(collegeId, current, other, { reasons: [...reasons], sharedIndicators, similarity });
  }
}

async function loadPair(user, caseId, otherId) {
  if (!isValidObjectId(caseId) || !isValidObjectId(otherId)) throw new AppError(404, 'NOT_FOUND', 'Case not found');
  if (String(caseId) === String(otherId)) throw new AppError(400, 'INVALID_LINK', 'A case cannot be linked to itself');
  const cases = caseRepository.forTenant(user.collegeId);
  const [a, b] = await Promise.all([cases.findById(caseId, { lean: true }), cases.findById(otherId, { lean: true })]);
  // Another college's case is indistinguishable from a missing one.
  if (!a || !b) throw new AppError(404, 'NOT_FOUND', 'Case not found');
  return [a, b];
}

async function linkManually(user, caseId, otherId, { ip }) {
  const [a, b] = await loadPair(user, caseId, otherId);
  await linkPair(user.collegeId, a, b, { reasons: ['manual'], linkedBy: user.id }, user);
  await audit.record({
    collegeId: user.collegeId,
    actor: { id: user.id, role: user.role },
    action: 'case.link',
    entityType: 'case',
    entityId: a._id,
    metadata: { otherCaseId: String(b._id) },
    ip,
  });
}

async function unlink(user, caseId, otherId, { ip }) {
  const [a, b] = await loadPair(user, caseId, otherId);
  if (!(a.linkedCaseIds ?? []).some((id) => String(id) === String(b._id))) throw new AppError(404, 'NOT_FOUND', 'These cases are not linked');
  const cases = caseRepository.forTenant(user.collegeId);
  const events = caseEventRepository.forTenant(user.collegeId);
  for (const [self, other] of [[a, b], [b, a]]) {
    await cases.updateOne({ _id: self._id }, { $pull: { related: { caseId: other._id }, linkedCaseIds: other._id } });
    await events.create({
      caseId: self._id,
      type: 'linked',
      actorId: user.id,
      actorRole: user.role,
      visibleToStudent: false,
      metadata: { action: 'unlink', otherCaseId: String(other._id), otherCaseNumber: other.caseNumber },
    });
  }
  await audit.record({
    collegeId: user.collegeId,
    actor: { id: user.id, role: user.role },
    action: 'case.unlink',
    entityType: 'case',
    entityId: a._id,
    metadata: { otherCaseId: String(b._id) },
    ip,
  });
}

module.exports = { detectLinks, linkManually, unlink, linkableIndicators };
