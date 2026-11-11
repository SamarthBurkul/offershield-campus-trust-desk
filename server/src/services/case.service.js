'use strict';

const { isValidObjectId } = require('mongoose');
const AppError = require('../utils/AppError');
const { College } = require('../models/College');
const { caseRepository, caseEventRepository, counterRepository, evidenceRepository } = require('../repositories');
const { isClosedStatus } = require('../constants/caseStatus');
const { assertNoSensitiveIds } = require('../utils/privacyGuard');
const { extractIndicators, mergeIndicators } = require('./indicators/extract');
const {
  toStudentCaseView,
  toStudentCaseSummary,
  toStudentEventView,
  toStudentEvidenceView,
} = require('../utils/caseViews');
const audit = require('./audit.service');
const { allowedFrom } = require('./caseStateMachine');
const { simhash64 } = require('./linking/simhash');
const { detectLinks } = require('./linking/link.service');
const { refreshCaseSignals } = require('./signals/loader');
const notifications = require('./notifications/notify');

/** Context for notification templates: only these student-visible case fields. */
const caseContext = (doc) => ({ caseNumber: doc.caseNumber, claimedCompany: doc.claimedCompany });

/** Staff-only derived data after student activity: related-case links, then warning signals. */
async function refreshDerivedData(collegeId, caseId, { simhashMaxDistance }) {
  await detectLinks(collegeId, caseId, { maxDistance: simhashMaxDistance });
  await refreshCaseSignals(collegeId, caseId);
}

const caseNotFound = () => new AppError(404, 'NOT_FOUND', 'Request not found');
const caseClosed = () => new AppError(409, 'CASE_CLOSED', 'This request is closed and cannot be changed');

async function nextCaseNumber(collegeId) {
  const college = await College.findById(collegeId).select('code').lean();
  if (!college) throw new AppError(404, 'NOT_FOUND', 'College not found');
  const counter = await counterRepository
    .forTenant(collegeId)
    .findOneAndUpdate({ key: 'case' }, { $inc: { seq: 1 } }, { upsert: true });
  return `OS-${college.code.toUpperCase()}-${String(counter.seq).padStart(4, '0')}`;
}

/**
 * Load a case owned by this student in their college. Other students' and other colleges' cases
 * are indistinguishable from missing ones (404).
 */
async function findOwnedCaseById(student, caseId) {
  if (!isValidObjectId(caseId)) throw caseNotFound();
  const found = await caseRepository.forTenant(student.collegeId).findOne({ _id: caseId, studentId: student.id });
  if (!found) throw caseNotFound();
  return found;
}

async function createCase(student, input, { ip, simhashMaxDistance }) {
  assertNoSensitiveIds([input.messageText, input.studentNote, input.claimedCompany, input.roleTitle, Object.values(input.contacts)]);

  const collegeId = student.collegeId;
  const caseNumber = await nextCaseNumber(collegeId);
  const now = new Date();

  const created = await caseRepository.forTenant(collegeId).create({
    claimedCompany: input.claimedCompany,
    roleTitle: input.roleTitle,
    channel: input.channel,
    receivedAt: input.receivedAt,
    messageText: input.messageText,
    links: input.links,
    contacts: input.contacts,
    moneyRequested: input.moneyRequested,
    paidAlready: input.paidAlready,
    documentsShared: input.documentsShared,
    studentNote: input.studentNote,
    caseNumber,
    studentId: student.id,
    consentAt: now,
    status: 'submitted',
    priority: input.moneyRequested.requested || input.paidAlready ? 'high' : 'normal',
    indicators: extractIndicators(input),
    textHash: simhash64(input.messageText),
    lastActivityAt: now,
  });

  // No transactions: if the timeline entry cannot be written, remove the case again.
  try {
    await caseEventRepository.forTenant(collegeId).create({
      caseId: created._id,
      type: 'created',
      actorId: student.id,
      actorRole: student.role,
      body: null,
      visibleToStudent: true,
      metadata: { caseNumber },
    });
  } catch (err) {
    await caseRepository.forTenant(collegeId).deleteOne({ _id: created._id });
    throw err;
  }

  await audit.record({
    collegeId,
    actor: { id: student.id, role: student.role },
    action: 'case.create',
    entityType: 'case',
    entityId: created._id,
    metadata: { caseNumber, priority: created.priority, indicatorCount: created.indicators.length },
    ip,
  });

  await refreshDerivedData(collegeId, created._id, { simhashMaxDistance });
  await notifications.notifySafely(collegeId, await notifications.activeStaffIds(collegeId), {
    type: 'case_submitted',
    context: caseContext(created),
    link: `/staff/cases/${created._id}`,
    refType: 'case',
    refId: created._id,
    excludeUserId: student.id,
  });
  return toStudentCaseView(created);
}

async function listMyCases(student, { status, page, limit }) {
  const cases = caseRepository.forTenant(student.collegeId);
  const filter = { studentId: student.id, ...(status ? { status } : {}) };
  const [items, total] = await Promise.all([
    cases.find(filter, { sort: { createdAt: -1, _id: -1 }, skip: (page - 1) * limit, limit, lean: true }),
    cases.count(filter),
  ]);
  return { cases: items.map(toStudentCaseSummary), page, limit, total };
}

async function getCaseForStudent(student, caseId) {
  const found = await findOwnedCaseById(student, caseId);
  const [events, evidence] = await Promise.all([
    caseEventRepository
      .forTenant(student.collegeId)
      .find({ caseId: found._id, visibleToStudent: true }, { sort: { createdAt: 1, _id: 1 }, lean: true }),
    evidenceRepository.forTenant(student.collegeId).find({ caseId: found._id }, { sort: { createdAt: 1 }, lean: true }),
  ]);
  return {
    case: toStudentCaseView(found),
    events: events.map(toStudentEventView),
    evidence: evidence.map(toStudentEvidenceView),
  };
}

async function addStudentMessage(student, caseId, { body }, { ip, simhashMaxDistance }) {
  const found = await findOwnedCaseById(student, caseId);
  if (isClosedStatus(found.status)) throw caseClosed();
  assertNoSensitiveIds([body]);

  const collegeId = student.collegeId;
  const events = caseEventRepository.forTenant(collegeId);
  const now = new Date();

  await events.create({
    caseId: found._id,
    type: 'student_message',
    actorId: student.id,
    actorRole: student.role,
    body,
    visibleToStudent: true,
  });

  const cases = caseRepository.forTenant(collegeId);
  const indicators = mergeIndicators(found.indicators, extractIndicators({ messageText: body }));

  // A reply answers the placement cell's question, so the case goes back for review (atomic, conditional).
  const reopened = await cases.findOneAndUpdate(
    { _id: found._id, studentId: student.id, status: { $in: allowedFrom('student_reply', 'under_review') } },
    { $set: { status: 'under_review', lastActivityAt: now, indicators } },
  );
  const reopensReview = Boolean(reopened);
  if (!reopensReview) {
    await cases.updateOne({ _id: found._id, studentId: student.id }, { $set: { lastActivityAt: now, indicators } });
  } else {
    await events.create({
      caseId: found._id,
      type: 'status_changed',
      actorId: student.id,
      actorRole: student.role,
      body: 'Your reply was received. Your request is back under review.',
      visibleToStudent: true,
      metadata: { from: 'awaiting_student', to: 'under_review' },
    });
  }

  await audit.record({
    collegeId,
    actor: { id: student.id, role: student.role },
    action: 'case.student_message',
    entityType: 'case',
    entityId: found._id,
    metadata: { statusChanged: reopensReview },
    ip,
  });

  await refreshDerivedData(collegeId, found._id, { simhashMaxDistance });

  // The assignee hears about the reply; with no (active) assignee, all active staff do.
  const staff = await notifications.activeStaffIds(collegeId);
  const assignee = found.assigneeId ? String(found.assigneeId) : null;
  await notifications.notifySafely(collegeId, assignee && staff.includes(assignee) ? [assignee] : staff, {
    type: 'case_student_reply',
    context: caseContext(found),
    link: `/staff/cases/${found._id}`,
    refType: 'case',
    refId: found._id,
    excludeUserId: student.id,
  });

  return getCaseForStudent(student, found._id);
}

module.exports = { createCase, listMyCases, getCaseForStudent, addStudentMessage, findOwnedCaseById, caseNotFound, caseClosed };
