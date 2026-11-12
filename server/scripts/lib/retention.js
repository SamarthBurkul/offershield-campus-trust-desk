'use strict';

const { Case } = require('../../src/models/Case');
const { CLOSED_STATUSES } = require('../../src/constants/caseStatus');
const { evidenceRepository, caseEventRepository } = require('../../src/repositories');
const storage = require('../../src/services/storage.service');
const audit = require('../../src/services/audit.service');

/** The date `months` calendar months before `now`. */
function monthsBefore(now, months) {
  const cutoff = new Date(now);
  cutoff.setMonth(cutoff.getMonth() - months);
  return cutoff;
}

/**
 * Evidence retention: find cases closed (decided) more than `months` ago that still hold evidence.
 * Dry run by default. With apply, delete those files (GridFS + Evidence records), add a staff-only
 * "evidence_purged" timeline event and one audit entry per case. Cases themselves are never deleted.
 * @returns {Promise<{ cutoff: Date, applied: boolean, cases: Array<{ collegeId: string, caseNumber: string, evidenceCount: number }> }>}
 */
async function runRetention({ months, apply = false, now = new Date() }) {
  const cutoff = monthsBefore(now, months);
  const candidates = await Case.find({ status: { $in: CLOSED_STATUSES }, 'decision.decidedAt': { $lt: cutoff } })
    .select('_id collegeId caseNumber')
    .lean();

  const cases = [];
  for (const found of candidates) {
    const evidenceRepo = evidenceRepository.forTenant(found.collegeId);
    const evidence = await evidenceRepo.find({ caseId: found._id }, { select: '_id gridFsId', lean: true });
    if (evidence.length === 0) continue;
    cases.push({ collegeId: String(found.collegeId), caseNumber: found.caseNumber, evidenceCount: evidence.length });
    if (!apply) continue;

    for (const item of evidence) await storage.deleteFile(item.gridFsId);
    await evidenceRepo.deleteMany({ caseId: found._id, _id: { $in: evidence.map((item) => item._id) } });
    await caseEventRepository.forTenant(found.collegeId).create({
      caseId: found._id,
      type: 'evidence_purged',
      actorId: null,
      actorRole: 'system',
      body: null,
      visibleToStudent: false,
      metadata: { count: evidence.length, retentionMonths: months },
    });
    await audit.record({
      collegeId: found.collegeId,
      actor: null,
      action: 'evidence.purged',
      entityType: 'case',
      entityId: found._id,
      metadata: { count: evidence.length, retentionMonths: months },
    });
  }
  return { cutoff, applied: apply, cases };
}

module.exports = { runRetention, monthsBefore };
