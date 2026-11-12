'use strict';

const AppError = require('../utils/AppError');
const { ROLES } = require('../models/User');
const { userRepository } = require('../repositories');
const { idOf } = require('../utils/safeUser');
const audit = require('./audit.service');

const studentNotFound = () => new AppError(404, 'NOT_FOUND', 'Student not found');
const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** What staff see about a student account: identity, profile and account state only. */
function toStudentAccountView(user) {
  return {
    id: idOf(user._id),
    name: user.name,
    email: user.email,
    year: user.year ?? null,
    branch: user.branch ?? null,
    status: user.status,
    mustChangePassword: Boolean(user.mustChangePassword),
    createdAt: user.createdAt ?? null,
    lastLoginAt: user.lastLoginAt ?? null,
  };
}

function listFilter({ status, year, branch, q }) {
  const filter = { role: ROLES.STUDENT };
  if (status) filter.status = status;
  if (year) filter.year = year;
  if (branch) filter.branch = branch;
  if (q) {
    const pattern = { $regex: escapeRegex(q), $options: 'i' };
    filter.$or = [{ name: pattern }, { email: pattern }];
  }
  return filter;
}

async function listStudents(user, query) {
  const users = userRepository.forTenant(user.collegeId);
  const filter = listFilter(query);
  const [items, total, pendingCount] = await Promise.all([
    users.find(filter, { sort: { createdAt: -1, _id: -1 }, skip: (query.page - 1) * query.limit, limit: query.limit, lean: true }),
    users.count(filter),
    users.count({ role: ROLES.STUDENT, status: 'pending_approval' }),
  ]);
  return { students: items.map(toStudentAccountView), page: query.page, limit: query.limit, total, pendingCount };
}

/** A student of the actor's own college; another college's id is indistinguishable from a missing one. */
async function findStudentOr404(user, id) {
  const target = await userRepository.forTenant(user.collegeId).findById(id, { lean: true });
  if (!target || target.role !== ROLES.STUDENT) throw studentNotFound();
  return target;
}

const invalidChange = (message) => new AppError(409, 'INVALID_STATUS_CHANGE', message);

function recordAudit(user, studentId, action, metadata, ip) {
  return audit.record({
    collegeId: user.collegeId,
    actor: { id: user.id, role: user.role },
    action,
    entityType: 'user',
    entityId: studentId,
    metadata,
    ip,
  });
}

/** Atomic status move: only succeeds while the student is still in one of the `from` statuses. */
async function moveStatus(user, studentId, from, update) {
  return userRepository
    .forTenant(user.collegeId)
    .findOneAndUpdate({ _id: studentId, role: ROLES.STUDENT, status: { $in: from } }, update);
}

async function approve(user, id, { ip }) {
  const target = await findStudentOr404(user, id);
  if (target.status === 'active') return toStudentAccountView(target);
  const updated = await moveStatus(user, target._id, ['pending_approval', 'rejected'], {
    $set: { status: 'active', rejectionReason: null },
  });
  if (!updated) throw invalidChange('Only pending or rejected students can be approved');
  await recordAudit(user, target._id, 'student.approve', { from: target.status }, ip);
  return toStudentAccountView(updated);
}

async function reject(user, id, { reason }, { ip }) {
  const target = await findStudentOr404(user, id);
  const updated = await moveStatus(user, target._id, ['pending_approval'], {
    $set: { status: 'rejected', rejectionReason: reason ?? null },
    // Ends the pending session immediately.
    $inc: { tokenVersion: 1 },
  });
  if (!updated) throw invalidChange('Only pending students can be rejected');
  // The reason stays on the account for staff; the audit entry records only that one was given.
  await recordAudit(user, target._id, 'student.reject', { hasReason: Boolean(reason) }, ip);
  return toStudentAccountView(updated);
}

async function bulkApprove(user, ids, { ip }) {
  const users = userRepository.forTenant(user.collegeId);
  const pending = await users.find(
    { _id: { $in: ids }, role: ROLES.STUDENT, status: 'pending_approval' },
    { select: '_id', lean: true },
  );
  const approved = [];
  for (const { _id } of pending) {
    const updated = await moveStatus(user, _id, ['pending_approval'], { $set: { status: 'active', rejectionReason: null } });
    if (!updated) continue;
    approved.push(idOf(_id));
    await recordAudit(user, _id, 'student.approve', { from: 'pending_approval', bulk: true }, ip);
  }
  // Ids from another college, already active or unknown are skipped without saying which.
  return { approved, skipped: ids.length - approved.length };
}

async function setStatus(user, id, status, { ip }) {
  const target = await findStudentOr404(user, id);
  if (target.status === status) return toStudentAccountView(target);
  const from = status === 'disabled' ? ['active'] : ['disabled'];
  const update = { $set: { status } };
  // Disabling revokes every live session at once.
  if (status === 'disabled') update.$inc = { tokenVersion: 1 };
  const updated = await moveStatus(user, target._id, from, update);
  if (!updated) throw invalidChange('Use approve or reject for students awaiting approval');
  await recordAudit(user, target._id, 'student.status_change', { from: target.status, to: status }, ip);
  return toStudentAccountView(updated);
}

module.exports = { listStudents, approve, reject, bulkApprove, setStatus, toStudentAccountView };
