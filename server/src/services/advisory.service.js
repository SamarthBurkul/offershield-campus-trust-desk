'use strict';

/**
 * Campus advisories built from confirmed findings. Officers and the TPO head draft; only the head
 * publishes (fanning out notifications) or withdraws. Published advisories are immutable.
 */
const { isValidObjectId } = require('mongoose');
const AppError = require('../utils/AppError');
const { College } = require('../models/College');
const {
  advisoryRepository,
  acknowledgementRepository,
  fraudIndicatorRepository,
  caseRepository,
  userRepository,
} = require('../repositories');
const { assertNoSensitiveIds } = require('../utils/privacyGuard');
const { idOf } = require('../utils/safeUser');
const notifications = require('./notifications/notify');
const audit = require('./audit.service');

const iso = (date) => (date ? new Date(date).toISOString() : null);
const isHead = (user) => user.role === 'tpo_head';
const notFound = () => new AppError(404, 'NOT_FOUND', 'Advisory not found');

function recordAudit(user, advisoryId, action, metadata, ip) {
  return audit.record({ collegeId: user.collegeId, actor: { id: user.id, role: user.role }, action, entityType: 'advisory', entityId: advisoryId, metadata, ip });
}

/** Mongo filter for active students matching a target (empty arrays mean everyone). */
function audienceFilter(target) {
  return {
    role: 'student',
    status: 'active',
    ...(target.years?.length ? { year: { $in: target.years } } : {}),
    ...(target.branches?.length ? { branch: { $in: target.branches } } : {}),
  };
}

const countAudience = (collegeId, target) => userRepository.forTenant(collegeId).count(audienceFilter(target));

/** Advisory filter matching one student's year and branch. */
const studentTargetFilter = (student) => ({
  $and: [
    { $or: [{ 'target.years': { $size: 0 } }, { 'target.years': student.year }] },
    { $or: [{ 'target.branches': { $size: 0 } }, { 'target.branches': student.branch }] },
  ],
});

async function validateTarget(collegeId, target) {
  const branches = [...new Set((target.branches ?? []).map((branch) => branch.trim().toUpperCase()))];
  if (branches.length) {
    const college = await College.findById(collegeId).select('branches').lean();
    const unknown = branches.filter((branch) => !college?.branches.includes(branch));
    if (unknown.length) throw new AppError(400, 'VALIDATION_ERROR', `Invalid request: target.branches: ${unknown.join(', ')} is not a branch of your college`);
  }
  return { years: [...new Set(target.years ?? [])].sort(), branches };
}

async function validateIndicators(collegeId, indicatorIds) {
  const ids = [...new Set(indicatorIds.map(String))];
  if (ids.length === 0) return [];
  const active = ids.every(isValidObjectId)
    ? await fraudIndicatorRepository.forTenant(collegeId).find({ _id: { $in: ids }, status: 'active' }, { select: '_id', lean: true })
    : [];
  if (active.length !== ids.length) {
    throw new AppError(400, 'INVALID_INDICATOR', 'Advisories can only link active confirmed indicators of your college');
  }
  return ids;
}

/** The source case must be a confirmed_fraud case of this college; returns its student's identity for the identity check. */
async function validateSourceCase(collegeId, sourceCaseId) {
  if (!sourceCaseId) return null;
  const source = isValidObjectId(sourceCaseId)
    ? await caseRepository.forTenant(collegeId).findOne({ _id: sourceCaseId, status: 'confirmed_fraud' }, { select: 'studentId', lean: true })
    : null;
  if (!source) throw new AppError(400, 'INVALID_SOURCE_CASE', 'The source case must be a confirmed fraud case of your college');
  const student = await userRepository.forTenant(collegeId).findById(source.studentId, { select: 'name email', lean: true });
  return { id: source._id, student };
}

/** Advisory text must not identify the student who reported the case, nor contain PAN/Aadhaar. */
function assertSafeText({ title, body }, sourceStudent) {
  assertNoSensitiveIds([title, body]);
  if (!sourceStudent) return;
  const text = `${title}\n${body}`.toLowerCase();
  const identifiers = [sourceStudent.name, sourceStudent.email].filter((value) => value && value.trim().length >= 3).map((value) => value.trim().toLowerCase());
  if (identifiers.some((value) => text.includes(value))) {
    throw new AppError(400, 'CONTAINS_STUDENT_IDENTITY', "Advisories must not name or identify the student who reported the case");
  }
}

function assertFutureExpiry(expiresAt) {
  if (expiresAt && new Date(expiresAt).getTime() <= Date.now()) {
    throw new AppError(400, 'VALIDATION_ERROR', 'Invalid request: expiresAt: must be in the future');
  }
}

async function findOr404(user, id) {
  if (!isValidObjectId(id)) throw notFound();
  const advisory = await advisoryRepository.forTenant(user.collegeId).findById(id);
  if (!advisory) throw notFound();
  return advisory;
}

async function indicatorsById(collegeId, ids) {
  if (!ids.length) return new Map();
  const items = await fraudIndicatorRepository.forTenant(collegeId).find({ _id: { $in: ids } }, { select: 'type value status', lean: true });
  return new Map(items.map((item) => [String(item._id), item]));
}

async function ackCounts(collegeId, advisoryIds) {
  if (!advisoryIds.length) return new Map();
  const rows = await acknowledgementRepository
    .forTenant(collegeId)
    .aggregate([{ $match: { advisoryId: { $in: advisoryIds } } }, { $group: { _id: '$advisoryId', count: { $sum: 1 } } }]);
  return new Map(rows.map((row) => [String(row._id), row.count]));
}

const rate = (acknowledged, audience) => (audience ? Math.round((acknowledged / audience) * 1000) / 1000 : 0);

function toStaffView(advisory, { indicators, acknowledgedCount = 0, audienceCount = null }) {
  const linked = advisory.indicatorIds.map((id) => indicators.get(String(id))).filter(Boolean);
  return {
    id: idOf(advisory._id),
    title: advisory.title,
    body: advisory.body,
    severity: advisory.severity,
    target: { years: [...advisory.target.years], branches: [...advisory.target.branches] },
    indicators: linked.map((item) => ({ id: String(item._id), type: item.type, value: item.value, status: item.status })),
    indicatorIds: advisory.indicatorIds.map(String),
    sourceCaseId: idOf(advisory.sourceCaseId),
    status: advisory.status,
    needsReview: linked.length !== advisory.indicatorIds.length || linked.some((item) => item.status !== 'active'),
    createdBy: idOf(advisory.createdBy),
    publishedAt: iso(advisory.publishedAt),
    withdrawnAt: iso(advisory.withdrawnAt),
    withdrawReason: advisory.withdrawReason ?? null,
    expiresAt: iso(advisory.expiresAt),
    audienceCount,
    acknowledgedCount,
    ackRate: rate(acknowledgedCount, audienceCount),
    createdAt: iso(advisory.createdAt),
    updatedAt: iso(advisory.updatedAt),
  };
}

// ------------------------------------------------------------------------------------------------
// Staff

async function listForStaff(user, { status, page, limit }) {
  const repo = advisoryRepository.forTenant(user.collegeId);
  const filter = status ? { status } : {};
  const [items, total] = await Promise.all([
    repo.find(filter, { sort: { updatedAt: -1, _id: -1 }, skip: (page - 1) * limit, limit, lean: true }),
    repo.count(filter),
  ]);
  const indicators = await indicatorsById(user.collegeId, items.flatMap((item) => item.indicatorIds));
  const acks = await ackCounts(user.collegeId, items.map((item) => item._id));
  const views = await Promise.all(
    items.map(async (item) =>
      toStaffView(item, {
        indicators,
        acknowledgedCount: acks.get(String(item._id)) ?? 0,
        audienceCount: item.status === 'draft' ? await countAudience(user.collegeId, item.target) : item.audienceCountAtPublish,
      }),
    ),
  );
  return { advisories: views, page, limit, total };
}

async function audienceCount(user, target) {
  return countAudience(user.collegeId, await validateTarget(user.collegeId, target));
}

async function getForStaff(user, id) {
  const advisory = await findOr404(user, id);
  const indicators = await indicatorsById(user.collegeId, advisory.indicatorIds);
  const acks = acknowledgementRepository.forTenant(user.collegeId);
  const [acknowledgedCount, byYear, byBranch] = await Promise.all([
    acks.count({ advisoryId: advisory._id }),
    acks.aggregate([{ $match: { advisoryId: advisory._id } }, { $group: { _id: '$year', count: { $sum: 1 } } }, { $sort: { _id: 1 } }]),
    acks.aggregate([{ $match: { advisoryId: advisory._id } }, { $group: { _id: '$branch', count: { $sum: 1 } } }, { $sort: { _id: 1 } }]),
  ]);
  const audience = advisory.status === 'draft' ? await countAudience(user.collegeId, advisory.target) : advisory.audienceCountAtPublish;
  return {
    ...toStaffView(advisory, { indicators, acknowledgedCount, audienceCount: audience }),
    // Counts only, never names.
    acknowledgementBreakdown: {
      byYear: byYear.map((row) => ({ year: row._id, count: row.count })),
      byBranch: byBranch.map((row) => ({ branch: row._id, count: row.count })),
    },
  };
}

async function prepare(user, input, existing = null) {
  const merged = {
    title: input.title ?? existing?.title,
    body: input.body ?? existing?.body,
    target: input.target ?? existing?.target ?? { years: [], branches: [] },
    indicatorIds: input.indicatorIds ?? existing?.indicatorIds?.map(String) ?? [],
    sourceCaseId: input.sourceCaseId !== undefined ? input.sourceCaseId : idOf(existing?.sourceCaseId),
    expiresAt: input.expiresAt !== undefined ? input.expiresAt : existing?.expiresAt,
  };
  assertFutureExpiry(merged.expiresAt);
  const target = await validateTarget(user.collegeId, merged.target);
  const indicatorIds = await validateIndicators(user.collegeId, merged.indicatorIds);
  const source = await validateSourceCase(user.collegeId, merged.sourceCaseId);
  assertSafeText(merged, source?.student);
  return { target, indicatorIds, sourceCaseId: source?.id ?? null, expiresAt: merged.expiresAt ?? null };
}

async function createDraft(user, input, { ip }) {
  const checked = await prepare(user, input);
  const advisory = await advisoryRepository.forTenant(user.collegeId).create({
    title: input.title,
    body: input.body,
    severity: input.severity,
    ...checked,
    status: 'draft',
    createdBy: user.id,
    updatedBy: user.id,
  });
  await recordAudit(user, advisory._id, 'advisory.create', { severity: advisory.severity, indicatorCount: checked.indicatorIds.length, fromCase: Boolean(checked.sourceCaseId) }, ip);
  return getForStaff(user, advisory._id);
}

async function updateDraft(user, id, input, { ip }) {
  const advisory = await findOr404(user, id);
  if (advisory.status !== 'draft') throw new AppError(409, 'ADVISORY_NOT_EDITABLE', 'Published or withdrawn advisories cannot be edited. Withdraw it and publish a new one.');
  if (!isHead(user) && String(advisory.createdBy) !== user.id) throw new AppError(403, 'FORBIDDEN', 'Only the author or the TPO head can edit this draft');
  const checked = await prepare(user, input, advisory);
  const update = { ...checked, updatedBy: user.id };
  for (const key of ['title', 'body', 'severity']) if (input[key] !== undefined) update[key] = input[key];
  const saved = await advisoryRepository.forTenant(user.collegeId).findOneAndUpdate({ _id: advisory._id, status: 'draft' }, { $set: update });
  if (!saved) throw new AppError(409, 'ADVISORY_NOT_EDITABLE', 'This advisory is no longer a draft');
  await recordAudit(user, advisory._id, 'advisory.update', { fields: Object.keys(input) }, ip);
  return getForStaff(user, advisory._id);
}

async function publish(user, id, { ip }) {
  const advisory = await findOr404(user, id);
  if (advisory.status !== 'draft') throw new AppError(409, 'ADVISORY_NOT_EDITABLE', 'Only drafts can be published');
  await validateIndicators(user.collegeId, advisory.indicatorIds);
  assertFutureExpiry(advisory.expiresAt);

  const students = await userRepository.forTenant(user.collegeId).find(audienceFilter(advisory.target), { select: '_id', lean: true });
  const published = await advisoryRepository.forTenant(user.collegeId).findOneAndUpdate(
    { _id: advisory._id, status: 'draft' },
    { $set: { status: 'published', publishedBy: user.id, publishedAt: new Date(), audienceCountAtPublish: students.length, updatedBy: user.id } },
  );
  if (!published) throw new AppError(409, 'ADVISORY_NOT_EDITABLE', 'This advisory was changed by someone else');

  await recordAudit(user, advisory._id, 'advisory.publish', { audienceCount: students.length, indicatorCount: advisory.indicatorIds.length }, ip);
  await notifications.notifySafely(user.collegeId, students.map((student) => String(student._id)), {
    type: 'advisory_published',
    context: { advisoryTitle: advisory.title, severity: advisory.severity },
    link: `/advisories/${advisory._id}`,
    refType: 'advisory',
    refId: advisory._id,
    excludeUserId: user.id,
  });
  return getForStaff(user, advisory._id);
}

async function withdraw(user, id, { reason }, { ip }) {
  const advisory = await findOr404(user, id);
  const withdrawn = await advisoryRepository.forTenant(user.collegeId).findOneAndUpdate(
    { _id: advisory._id, status: 'published' },
    { $set: { status: 'withdrawn', withdrawnBy: user.id, withdrawnAt: new Date(), withdrawReason: reason } },
  );
  if (!withdrawn) throw new AppError(409, 'ADVISORY_NOT_EDITABLE', 'Only published advisories can be withdrawn');
  await recordAudit(user, advisory._id, 'advisory.withdraw', { reasonLength: reason.length }, ip);
  return getForStaff(user, advisory._id);
}

// ------------------------------------------------------------------------------------------------
// Students

const visibleFilter = (student) => ({
  status: 'published',
  $and: [{ $or: [{ expiresAt: null }, { expiresAt: { $gt: new Date() } }] }, ...studentTargetFilter(student).$and],
});

/** Never sourceCaseId, authors or inactive indicators. */
function toStudentView(advisory, indicators, acknowledged) {
  return {
    id: idOf(advisory._id),
    status: 'published',
    title: advisory.title,
    body: advisory.body,
    severity: advisory.severity,
    publishedAt: iso(advisory.publishedAt),
    acknowledged,
    indicators: advisory.indicatorIds
      .map((id) => indicators.get(String(id)))
      .filter((item) => item && item.status === 'active')
      .map(({ type, value }) => ({ type, value })),
  };
}

const SEVERITY_ORDER = { critical: 0, warning: 1, info: 2 };

async function listForStudent(student) {
  const items = await advisoryRepository.forTenant(student.collegeId).find(visibleFilter(student), { sort: { publishedAt: -1 }, limit: 100, lean: true });
  const indicators = await indicatorsById(student.collegeId, items.flatMap((item) => item.indicatorIds));
  const acks = await acknowledgementRepository
    .forTenant(student.collegeId)
    .find({ userId: student.id, advisoryId: { $in: items.map((item) => item._id) } }, { select: 'advisoryId', lean: true });
  const acked = new Set(acks.map((ack) => String(ack.advisoryId)));
  const views = items.map((item) => toStudentView(item, indicators, acked.has(String(item._id))));
  // Unacknowledged first (critical first among them), then newest.
  return views.sort(
    (a, b) =>
      Number(a.acknowledged) - Number(b.acknowledged) ||
      (!a.acknowledged ? SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity] : 0) ||
      b.publishedAt.localeCompare(a.publishedAt),
  );
}

async function findVisibleForStudent(student, id) {
  if (!isValidObjectId(id)) return null;
  return advisoryRepository.forTenant(student.collegeId).findOne({ _id: id, ...visibleFilter(student) }, { lean: true });
}

async function getForStudent(student, id) {
  const advisory = await findVisibleForStudent(student, id);
  if (!advisory) {
    // A student who was notified about a since-withdrawn advisory sees that it was withdrawn.
    const withdrawn = isValidObjectId(id)
      ? await advisoryRepository.forTenant(student.collegeId).findOne({ _id: id, status: 'withdrawn' }, { select: '_id', lean: true })
      : null;
    if (withdrawn && (await notifications.wasNotifiedAbout(student, 'advisory', withdrawn._id))) {
      return { id: String(withdrawn._id), status: 'withdrawn' };
    }
    throw notFound();
  }
  const indicators = await indicatorsById(student.collegeId, advisory.indicatorIds);
  const acked = await acknowledgementRepository.forTenant(student.collegeId).findOne({ userId: student.id, advisoryId: advisory._id }, { lean: true });
  return toStudentView(advisory, indicators, Boolean(acked));
}

async function acknowledge(student, id) {
  const advisory = await findVisibleForStudent(student, id);
  if (!advisory) throw notFound();
  const repo = acknowledgementRepository.forTenant(student.collegeId);
  try {
    await repo.findOneAndUpdate(
      { advisoryId: advisory._id, userId: student.id },
      { $setOnInsert: { year: student.year ?? null, branch: student.branch ?? null } },
      { upsert: true },
    );
  } catch (err) {
    // Two concurrent acks: the unique index keeps exactly one record.
    if (err?.code !== 11000) throw err;
  }
  return { acknowledged: true };
}

module.exports = {
  listForStaff,
  audienceCount,
  getForStaff,
  createDraft,
  updateDraft,
  publish,
  withdraw,
  listForStudent,
  getForStudent,
  acknowledge,
};
