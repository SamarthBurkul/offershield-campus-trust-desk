'use strict';

const { isValidObjectId } = require('mongoose');
const AppError = require('../utils/AppError');
const {
  caseRepository,
  caseEventRepository,
  evidenceRepository,
  noteRepository,
  userRepository,
} = require('../repositories');
const { OPEN_STATUSES, CLOSED_STATUSES, isClosedStatus } = require('../constants/caseStatus');
const { STAFF_ROLES } = require('../models/User');
const { allowedFrom } = require('./caseStateMachine');
const { normalizeDomain, normalizeEmail, normalizePhone, normalizeUpi, normalizeUrl } = require('./indicators/normalize');
const { toStaffCaseListItem, toStaffCaseView } = require('../utils/caseViews');
const audit = require('./audit.service');
const notifications = require('./notifications/notify');

const caseContext = (doc) => ({ caseNumber: doc.caseNumber, claimedCompany: doc.claimedCompany });

/** Notify the student who owns the case (never the acting staff member). */
function notifyStudent(user, found, type, context = {}) {
  return notifications.notifySafely(user.collegeId, [String(found.studentId)], {
    type,
    context: { ...caseContext(found), ...context },
    link: `/student/requests/${found._id}`,
    refType: 'case',
    refId: found._id,
    excludeUserId: user.id,
  });
}

const caseNotFound = () => new AppError(404, 'NOT_FOUND', 'Case not found');
const caseClosed = () => new AppError(409, 'CASE_CLOSED', 'This case is closed');
const invalidTransition = () =>
  new AppError(409, 'INVALID_TRANSITION', 'This case was updated by someone else or is not in a state that allows this action. Refresh and try again.');

const actorOf = (user) => ({ id: user.id, role: user.role });
const DAY_MS = 86_400_000;

// ----------------------------------------------------------------------------------------------
// Shared helpers (also used by note.service and decision.service)

async function findCaseOr404(user, caseId) {
  if (!isValidObjectId(caseId)) throw caseNotFound();
  const found = await caseRepository.forTenant(user.collegeId).findById(caseId);
  if (!found) throw caseNotFound();
  return found;
}

/** After a conditional update matched nothing: 404 if the case is not in this college, else 409. */
async function conflictOr404(user, caseId, { closedError = invalidTransition } = {}) {
  const current = await caseRepository.forTenant(user.collegeId).findById(caseId, { lean: true });
  if (!current) throw caseNotFound();
  if (isClosedStatus(current.status)) throw closedError();
  throw invalidTransition();
}

/**
 * Apply a state-machine transition atomically. Returns the case as it was BEFORE the update.
 * @param {object} [options] extra $set fields, plus closedError for the 409 when the case is closed
 */
async function transition(user, caseId, trigger, to, { set = {}, filter = {}, push, closedError } = {}) {
  const update = { $set: { status: to, lastActivityAt: new Date(), ...set } };
  if (push) update.$push = push;
  const before = await caseRepository
    .forTenant(user.collegeId)
    .findOneAndUpdate({ _id: caseId, ...filter, status: { $in: allowedFrom(trigger, to) } }, update, { returnDocument: 'before' });
  if (!before) await conflictOr404(user, caseId, { closedError });
  return before;
}

function addEvent(user, caseId, { type, body = null, visibleToStudent, metadata = {} }) {
  return caseEventRepository.forTenant(user.collegeId).create({
    caseId,
    type,
    actorId: user.id,
    actorRole: user.role,
    body,
    visibleToStudent,
    metadata,
  });
}

function recordAudit(user, caseId, action, metadata, ip) {
  return audit.record({ collegeId: user.collegeId, actor: actorOf(user), action, entityType: 'case', entityId: caseId, metadata, ip });
}

async function usersById(collegeId, ids) {
  const unique = [...new Set(ids.filter(Boolean).map(String))];
  if (unique.length === 0) return new Map();
  const users = await userRepository.forTenant(collegeId).find({ _id: { $in: unique } }, { select: 'name email role year branch', lean: true });
  return new Map(users.map((user) => [String(user._id), user]));
}

// ----------------------------------------------------------------------------------------------
// Queue, counts, detail

const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Values an indicator could have been stored as, using the Phase 3 normalisers. */
function indicatorCandidates(q) {
  const values = new Set([q.trim().toLowerCase()]);
  for (const value of [normalizePhone(q), normalizeDomain(q), normalizeEmail(q)?.email, normalizeUpi(q), normalizeUrl(q)?.url]) {
    if (value) values.add(value);
  }
  return [...values];
}

const SORTS = {
  lastActivity: { lastActivityAt: -1, _id: -1 },
  created: { createdAt: -1, _id: -1 },
  // "high" sorts before "normal" alphabetically.
  priority: { priority: 1, lastActivityAt: -1, _id: -1 },
};

function queueFilter(user, query) {
  const filter = {};
  if (query.status === 'open') filter.status = { $in: OPEN_STATUSES };
  else if (query.status === 'closed') filter.status = { $in: CLOSED_STATUSES };
  else if (query.status) filter.status = query.status;
  if (query.priority) filter.priority = query.priority;
  if (query.channel) filter.channel = query.channel;
  if (query.assignee === 'me') filter.assigneeId = user.id;
  else if (query.assignee === 'unassigned') filter.assigneeId = null;
  else if (query.assignee) filter.assigneeId = query.assignee;
  if (query.from || query.to) {
    filter.createdAt = {};
    if (query.from) filter.createdAt.$gte = query.from;
    if (query.to) filter.createdAt.$lte = query.to;
  }
  if (query.q) {
    filter.$or = [
      { caseNumber: query.q.toUpperCase() },
      { claimedCompany: { $regex: escapeRegex(query.q), $options: 'i' } },
      { 'indicators.value': { $in: indicatorCandidates(query.q) } },
    ];
  }
  return filter;
}

async function listQueue(user, query, { staleDays }) {
  const cases = caseRepository.forTenant(user.collegeId);
  const filter = queueFilter(user, query);
  const [items, total] = await Promise.all([
    cases.find(filter, { sort: SORTS[query.sort], skip: (query.page - 1) * query.limit, limit: query.limit, lean: true }),
    cases.count(filter),
  ]);

  const ids = items.map((item) => item._id);
  const [people, evidence] = await Promise.all([
    usersById(user.collegeId, items.flatMap((item) => [item.studentId, item.assigneeId])),
    ids.length ? evidenceRepository.forTenant(user.collegeId).find({ caseId: { $in: ids } }, { select: 'caseId', lean: true }) : [],
  ]);
  const evidenceCounts = new Map();
  for (const item of evidence) evidenceCounts.set(String(item.caseId), (evidenceCounts.get(String(item.caseId)) ?? 0) + 1);

  return {
    cases: items.map((item) =>
      toStaffCaseListItem(item, { usersById: people, evidenceCount: evidenceCounts.get(String(item._id)) ?? 0, staleDays }),
    ),
    page: query.page,
    limit: query.limit,
    total,
  };
}

async function getCounts(user, { staleDays }) {
  const cases = caseRepository.forTenant(user.collegeId);
  const open = { $in: OPEN_STATUSES };
  const staleBefore = new Date(Date.now() - staleDays * DAY_MS);
  const [submitted, underReview, awaitingStudent, openCount, closed, unassignedOpen, staleOpen] = await Promise.all([
    cases.count({ status: 'submitted' }),
    cases.count({ status: 'under_review' }),
    cases.count({ status: 'awaiting_student' }),
    cases.count({ status: open }),
    cases.count({ status: { $in: CLOSED_STATUSES } }),
    cases.count({ status: open, assigneeId: null }),
    cases.count({ status: open, lastActivityAt: { $lt: staleBefore } }),
  ]);
  return {
    submitted,
    under_review: underReview,
    awaiting_student: awaitingStudent,
    open: openCount,
    closed,
    unassignedOpen,
    staleOpen,
  };
}

async function getCaseForStaff(user, caseId, { staleDays }) {
  const found = await findCaseOr404(user, caseId);
  const collegeId = user.collegeId;
  const relatedIds = (found.related ?? []).map((entry) => entry.caseId);
  const [events, notes, evidence, relatedCases] = await Promise.all([
    caseEventRepository.forTenant(collegeId).find({ caseId: found._id }, { sort: { createdAt: 1, _id: 1 }, lean: true }),
    noteRepository.forTenant(collegeId).find({ caseId: found._id }, { sort: { createdAt: 1, _id: 1 }, lean: true }),
    evidenceRepository.forTenant(collegeId).find({ caseId: found._id }, { sort: { createdAt: 1 }, lean: true }),
    relatedIds.length
      ? caseRepository.forTenant(collegeId).find({ _id: { $in: relatedIds } }, { select: 'caseNumber status claimedCompany', lean: true })
      : [],
  ]);
  const people = await usersById(collegeId, [
    found.studentId,
    found.assigneeId,
    found.recommendation?.by,
    found.decision?.decidedBy,
    ...found.decisionHistory.flatMap((entry) => [entry.decidedBy, entry.reopenedBy]),
    ...events.map((event) => event.actorId),
    ...notes.map((note) => note.authorId),
  ]);
  const relatedById = new Map(relatedCases.map((item) => [String(item._id), item]));
  return toStaffCaseView(found, { usersById: people, events, notes, evidence, staleDays, relatedById });
}

// ----------------------------------------------------------------------------------------------
// Mutations

async function assignCase(user, caseId, assigneeId, { ip }) {
  const found = await findCaseOr404(user, caseId);
  const currentAssignee = found.assigneeId ? String(found.assigneeId) : null;

  // Officers may only take a case themselves or release their own assignment.
  if (user.role === 'placement_officer') {
    const allowed = assigneeId === user.id || (assigneeId === null && (currentAssignee === user.id || currentAssignee === null));
    if (!allowed) throw new AppError(403, 'FORBIDDEN', 'Placement officers can only assign cases to themselves');
  }
  if (assigneeId) {
    // Another college's user is simply not found in this tenant.
    const assignee = await userRepository
      .forTenant(user.collegeId)
      .findOne({ _id: assigneeId, role: { $in: STAFF_ROLES }, status: 'active' }, { lean: true });
    if (!assignee) throw new AppError(400, 'INVALID_ASSIGNEE', 'Assignee must be an active placement officer or TPO head of your college');
  }
  if (isClosedStatus(found.status)) throw caseClosed();

  const cases = caseRepository.forTenant(user.collegeId);
  const now = new Date();
  let startedReview = false;
  if (assigneeId && found.status === 'submitted') {
    const before = await cases.findOneAndUpdate(
      { _id: found._id, status: { $in: allowedFrom('assignment', 'under_review') } },
      { $set: { assigneeId, status: 'under_review', lastActivityAt: now } },
      { returnDocument: 'before' },
    );
    startedReview = Boolean(before);
  }
  if (!startedReview) {
    const result = await cases.updateOne({ _id: found._id, status: { $in: OPEN_STATUSES } }, { $set: { assigneeId, lastActivityAt: now } });
    if (result.matchedCount === 0) await conflictOr404(user, found._id, { closedError: caseClosed });
  }

  await addEvent(user, found._id, {
    type: 'assigned',
    visibleToStudent: false,
    metadata: { from: currentAssignee, to: assigneeId },
  });
  if (startedReview) {
    await addEvent(user, found._id, {
      type: 'status_changed',
      body: 'Your request is being reviewed by your placement cell.',
      visibleToStudent: true,
      metadata: { from: 'submitted', to: 'under_review' },
    });
  }
  await recordAudit(user, found._id, 'case.assign', { from: currentAssignee, to: assigneeId, statusChanged: startedReview }, ip);
  if (assigneeId && assigneeId !== currentAssignee) {
    await notifications.notifySafely(user.collegeId, [assigneeId], {
      type: 'case_assigned',
      context: caseContext(found),
      link: `/staff/cases/${found._id}`,
      refType: 'case',
      refId: found._id,
      excludeUserId: user.id,
    });
  }
}

async function changeStatus(user, caseId, { status }, { ip }) {
  const found = await findCaseOr404(user, caseId);
  const before = await transition(user, found._id, 'status_endpoint', status);
  await addEvent(user, found._id, {
    type: 'status_changed',
    body: 'Your request is being reviewed by your placement cell.',
    visibleToStudent: true,
    metadata: { from: before.status, to: status },
  });
  await recordAudit(user, found._id, 'case.status_change', { from: before.status, to: status }, ip);
}

async function requestInfo(user, caseId, { message }, { ip }) {
  const found = await findCaseOr404(user, caseId);
  const before = await transition(user, found._id, 'info_request', 'awaiting_student', { closedError: caseClosed });
  await addEvent(user, found._id, { type: 'info_requested', body: message, visibleToStudent: true, metadata: { from: before.status } });
  await recordAudit(user, found._id, 'case.info_request', { from: before.status }, ip);
  await notifyStudent(user, found, 'case_info_requested');
}

async function sendStaffMessage(user, caseId, { body }, { ip }) {
  const found = await findCaseOr404(user, caseId);
  const result = await caseRepository
    .forTenant(user.collegeId)
    .updateOne({ _id: found._id, status: { $in: OPEN_STATUSES } }, { $set: { lastActivityAt: new Date() } });
  if (result.matchedCount === 0) await conflictOr404(user, found._id, { closedError: caseClosed });
  await addEvent(user, found._id, { type: 'staff_message', body, visibleToStudent: true });
  await recordAudit(user, found._id, 'case.staff_message', { length: body.length }, ip);
  await notifyStudent(user, found, 'case_staff_message');
}

async function recommend(user, caseId, { type, basis }, { ip }) {
  const found = await findCaseOr404(user, caseId);
  const now = new Date();
  const result = await caseRepository
    .forTenant(user.collegeId)
    .updateOne(
      { _id: found._id, status: { $in: OPEN_STATUSES } },
      { $set: { recommendation: { type, basis, by: user.id, at: now }, lastActivityAt: now } },
    );
  if (result.matchedCount === 0) await conflictOr404(user, found._id, { closedError: caseClosed });
  // Staff-only: the student never learns about recommendations.
  await addEvent(user, found._id, { type: 'recommendation_made', visibleToStudent: false, metadata: { type } });
  await recordAudit(user, found._id, 'case.recommend', { type }, ip);
  await notifications.notifySafely(user.collegeId, await notifications.activeStaffIds(user.collegeId, ['tpo_head']), {
    type: 'case_recommendation',
    context: caseContext(found),
    link: `/staff/cases/${found._id}`,
    refType: 'case',
    refId: found._id,
    excludeUserId: user.id,
  });
}

module.exports = {
  listQueue,
  getCounts,
  getCaseForStaff,
  assignCase,
  changeStatus,
  requestInfo,
  sendStaffMessage,
  recommend,
  // shared helpers
  findCaseOr404,
  conflictOr404,
  transition,
  addEvent,
  recordAudit,
  notifyStudent,
  usersById,
  caseNotFound,
  invalidTransition,
};
