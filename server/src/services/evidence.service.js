'use strict';

const path = require('node:path');
const { createHash } = require('node:crypto');
const { isValidObjectId } = require('mongoose');
const AppError = require('../utils/AppError');
const { caseRepository, caseEventRepository, evidenceRepository } = require('../repositories');
const { isClosedStatus, EVIDENCE_LIMITS } = require('../constants/caseStatus');
const { detectFileType } = require('../utils/fileSignature');
const { stripImageMetadata, MalformedImageError } = require('../utils/stripImageMetadata');
const { signEvidenceLink, verifyEvidenceLink } = require('../utils/evidenceToken');
const { toStudentEvidenceView } = require('../utils/caseViews');
const storage = require('./storage.service');
const audit = require('./audit.service');
const { findOwnedCaseById, caseNotFound, caseClosed } = require('./case.service');

const STAFF_ROLES = ['placement_officer', 'tpo_head'];

const evidenceNotFound = () => new AppError(404, 'NOT_FOUND', 'Evidence not found');
const linkInvalid = () => new AppError(401, 'LINK_INVALID', 'This file link is invalid or has expired. Request a new one.');
const tooManyFiles = () =>
  new AppError(400, 'TOO_MANY_FILES', `A request can have at most ${EVIDENCE_LIMITS.maxFilesPerCase} evidence files`);
const unsupported = (message = 'Only PNG, JPEG and PDF files are accepted') =>
  new AppError(400, 'UNSUPPORTED_FILE_TYPE', message);

/** Basename only, safe characters, at most 100 chars, with the extension of the detected type. */
function sanitizeFileName(originalName, extension) {
  const base = path.basename(String(originalName ?? '').replace(/\\/g, '/'));
  const stem = base
    .replace(/\.[^.]*$/, '')
    .replace(/[^A-Za-z0-9 _-]+/g, '_')
    .replace(/_+/g, '_')
    .trim()
    .slice(0, 100 - extension.length - 1);
  return `${stem || 'evidence'}.${extension}`;
}

async function assertUploadAllowed(student, caseId, incomingCount = 0) {
  const found = await findOwnedCaseById(student, caseId);
  if (isClosedStatus(found.status)) throw caseClosed();
  const existing = await evidenceRepository.forTenant(student.collegeId).count({ caseId: found._id });
  if (existing + incomingCount > EVIDENCE_LIMITS.maxFilesPerCase) throw tooManyFiles();
  return found;
}

/** Validate every file by content and strip image metadata before anything is stored. */
function prepareFile(file) {
  const detected = detectFileType(file.buffer);
  if (!detected) throw unsupported();
  let processed;
  try {
    processed = stripImageMetadata(file.buffer, detected.mime);
  } catch (err) {
    if (err instanceof MalformedImageError) throw unsupported('The image file is damaged or not a valid PNG/JPEG');
    throw err;
  }
  return {
    buffer: processed.buffer,
    mime: detected.mime,
    metadataStripped: processed.metadataStripped,
    originalName: sanitizeFileName(file.originalname, detected.extension),
    sha256: createHash('sha256').update(processed.buffer).digest('hex'),
  };
}

async function uploadEvidence(student, caseId, files, { ip }) {
  if (!files || files.length === 0) throw new AppError(400, 'NO_FILES', 'Attach at least one file in the "files" field');
  const found = await assertUploadAllowed(student, caseId, files.length);
  const prepared = files.map(prepareFile);

  const collegeId = student.collegeId;
  const evidenceRepo = evidenceRepository.forTenant(collegeId);
  const storedFileIds = [];
  const created = [];
  try {
    for (const file of prepared) {
      const gridFsId = await storage.saveFile(file.buffer, {
        filename: file.originalName,
        contentType: file.mime,
        metadata: { collegeId, caseId: found._id, uploadedBy: student.id },
      });
      storedFileIds.push(gridFsId);
      created.push(
        await evidenceRepo.create({
          caseId: found._id,
          uploadedBy: student.id,
          originalName: file.originalName,
          mime: file.mime,
          size: file.buffer.length,
          sha256: file.sha256,
          gridFsId,
          metadataStripped: file.metadataStripped,
        }),
      );
    }
    await caseEventRepository.forTenant(collegeId).create({
      caseId: found._id,
      type: 'evidence_added',
      actorId: student.id,
      actorRole: student.role,
      visibleToStudent: true,
      metadata: { count: created.length, names: created.map((item) => item.originalName) },
    });
  } catch (err) {
    // No transactions: remove whatever this request stored.
    await Promise.all(created.map((item) => evidenceRepo.deleteOne({ _id: item._id })));
    await Promise.all(storedFileIds.map((id) => storage.deleteFile(id)));
    throw err;
  }

  await caseRepository.forTenant(collegeId).updateOne({ _id: found._id }, { $set: { lastActivityAt: new Date() } });
  await audit.record({
    collegeId,
    actor: { id: student.id, role: student.role },
    action: 'evidence.upload',
    entityType: 'case',
    entityId: found._id,
    metadata: {
      evidenceIds: created.map((item) => String(item._id)),
      mimes: created.map((item) => item.mime),
      totalBytes: created.reduce((sum, item) => sum + item.size, 0),
    },
    ip,
  });

  return created.map(toStudentEvidenceView);
}

/**
 * The case this user may see: a student only their own, staff any case of their college.
 * Anything else is 404.
 */
async function findAccessibleCase(user, caseId) {
  if (user.role === 'student') return findOwnedCaseById(user, caseId);
  if (!STAFF_ROLES.includes(user.role)) throw caseNotFound();
  const found = await caseRepository.forTenant(user.collegeId).findById(caseId);
  if (!found) throw caseNotFound();
  return found;
}

async function findCaseEvidence(collegeId, caseId, evidenceId) {
  if (!isValidObjectId(evidenceId)) throw evidenceNotFound();
  const evidence = await evidenceRepository.forTenant(collegeId).findOne({ _id: evidenceId, caseId });
  if (!evidence) throw evidenceNotFound();
  return evidence;
}

async function createEvidenceLink(user, caseId, evidenceId, config) {
  const found = await findAccessibleCase(user, caseId);
  const evidence = await findCaseEvidence(user.collegeId, found._id, evidenceId);
  const { token, expiresAt } = signEvidenceLink({ evidenceId: evidence._id, caseId: found._id, userId: user.id }, config);
  return { url: `/api/v1/files/${token}`, expiresAt: expiresAt.toISOString() };
}

/**
 * Second factor of a download: the short-lived link must be valid AND belong to the signed-in user,
 * and that user must still be allowed to see the case.
 */
async function openEvidenceDownload(user, token, config, { ip }) {
  const claims = verifyEvidenceLink(token, config);
  if (!claims || claims.uid !== user.id || !user.collegeId) throw linkInvalid();

  const found = await findAccessibleCase(user, claims.cid);
  const evidence = await findCaseEvidence(user.collegeId, found._id, claims.eid);

  await audit.record({
    collegeId: user.collegeId,
    actor: { id: user.id, role: user.role },
    action: 'evidence.access',
    entityType: 'evidence',
    entityId: evidence._id,
    metadata: { caseId: String(found._id) },
    ip,
  });

  return {
    stream: storage.openFileStream(evidence.gridFsId),
    mime: evidence.mime,
    size: evidence.size,
    originalName: evidence.originalName,
  };
}

module.exports = { assertUploadAllowed, uploadEvidence, createEvidenceLink, openEvidenceDownload, sanitizeFileName };
