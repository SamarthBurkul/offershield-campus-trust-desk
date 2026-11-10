'use strict';

const AppError = require('../utils/AppError');
const { College } = require('../models/College');
const { User, ROLES, STAFF_ROLES } = require('../models/User');
const { userRepository } = require('../repositories');
const { hashPassword } = require('../utils/password');
const { generateTemporaryPassword } = require('../utils/tokens');
const { toStaffSummary } = require('../utils/safeUser');
const audit = require('./audit.service');

const staffNotFound = () => new AppError(404, 'NOT_FOUND', 'Staff member not found');

/**
 * Create a staff account in a college with a one-time temporary password.
 * Shared by the super admin (first TPO head) and TPO heads (placement officers).
 * @returns {{ user: object, temporaryPassword: string }} the password is never stored or logged
 */
async function createStaffAccount({ college, role, name, email, actor, ip }) {
  const domain = email.split('@')[1];
  if (!college.emailDomains.includes(domain)) {
    throw new AppError(400, 'EMAIL_DOMAIN_MISMATCH', "The email domain does not belong to this college");
  }
  if (await User.exists({ email })) {
    throw new AppError(409, 'EMAIL_TAKEN', 'An account with this email already exists');
  }

  const temporaryPassword = generateTemporaryPassword();
  let user;
  try {
    user = await userRepository.forTenant(college._id).create({
      role,
      name,
      email,
      passwordHash: await hashPassword(temporaryPassword),
      mustChangePassword: true,
    });
  } catch (err) {
    if (err && err.code === 11000) throw new AppError(409, 'EMAIL_TAKEN', 'An account with this email already exists');
    throw err;
  }

  await audit.record({
    collegeId: college._id,
    actor,
    action: 'staff.create',
    entityType: 'user',
    entityId: user._id,
    metadata: { role, email },
    ip,
  });

  return { user: toStaffSummary(user), temporaryPassword };
}

async function listStaff(collegeId) {
  const staff = await userRepository
    .forTenant(collegeId)
    .find({ role: { $in: STAFF_ROLES } }, { sort: { role: -1, name: 1 } });
  return staff.map(toStaffSummary);
}

async function createOfficer(actor, tenant, input, { ip }) {
  const college = await College.findById(tenant.collegeId);
  if (!college) throw new AppError(404, 'NOT_FOUND', 'College not found');
  return createStaffAccount({ college, role: ROLES.PLACEMENT_OFFICER, ...input, actor, ip });
}

/**
 * Enable or disable a placement officer of the TPO head's own college.
 * Another college's officer is indistinguishable from a missing one (404).
 */
async function setOfficerStatus(actor, tenant, officerId, status, { ip }) {
  const users = userRepository.forTenant(tenant.collegeId);
  const target = await users.findById(officerId);

  if (!target) throw staffNotFound();
  if (String(target._id) === actor.id) {
    throw new AppError(400, 'CANNOT_MODIFY_SELF', 'You cannot change the status of your own account');
  }
  if (target.role === ROLES.TPO_HEAD) {
    throw new AppError(403, 'FORBIDDEN', 'TPO head accounts cannot be changed here');
  }
  if (target.role !== ROLES.PLACEMENT_OFFICER) throw staffNotFound();
  if (target.status === status) return toStaffSummary(target);

  const update = { $set: { status } };
  // Disabling also revokes every live session immediately.
  if (status === 'disabled') update.$inc = { tokenVersion: 1 };
  await users.updateOne({ _id: target._id }, update);

  await audit.record({
    collegeId: tenant.collegeId,
    actor,
    action: 'staff.status_change',
    entityType: 'user',
    entityId: target._id,
    metadata: { from: target.status, to: status },
    ip,
  });

  return toStaffSummary({ ...target.toObject(), status });
}

module.exports = { createStaffAccount, listStaff, createOfficer, setOfficerStatus };
