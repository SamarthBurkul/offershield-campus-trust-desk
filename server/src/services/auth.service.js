'use strict';

const mongoose = require('mongoose');
const AppError = require('../utils/AppError');
const { College } = require('../models/College');
const { User, ROLES } = require('../models/User');
const { userRepository } = require('../repositories');
const { hashPassword, verifyPassword, verifyAgainstDummy } = require('../utils/password');
const { normalizeJoinCode } = require('../utils/tokens');
const { toSafeUser, idOf } = require('../utils/safeUser');
const audit = require('./audit.service');

const invalidCredentials = () => new AppError(401, 'INVALID_CREDENTIALS', 'Invalid email or password');
const registrationRejected = () =>
  new AppError(400, 'REGISTRATION_REJECTED', 'Registration could not be completed. Check your college details.');
const emailTaken = () => new AppError(409, 'EMAIL_TAKEN', 'An account with this email already exists');

const isDuplicateKey = (err) => err && err.code === 11000;

/** The claims needed to issue a session cookie. Never sent in a response body. */
function sessionClaims(user) {
  return { id: idOf(user._id), role: user.role, collegeId: idOf(user.collegeId), tokenVersion: user.tokenVersion };
}

/**
 * Writes to the user's own record. College users go through the tenant repository;
 * the super admin has no college, so it is addressed by id alone.
 */
function updateOwnUser(user, update) {
  if (user.collegeId) return userRepository.forTenant(user.collegeId).updateOne({ _id: user._id }, update);
  return User.updateOne({ _id: user._id, role: ROLES.SUPER_ADMIN }, update);
}

async function isCollegeActive(collegeId) {
  const college = await College.findById(collegeId).select('status').lean();
  return Boolean(college && college.status === 'active');
}

async function register(input, { ip }) {
  const college = await College.findOne({ code: input.collegeCode, status: 'active' }).select('+studentJoinCodeHash');
  const joinCode = normalizeJoinCode(input.joinCode);
  // Always run one bcrypt comparison so a missing college is not faster than a wrong code.
  const joinCodeMatches = college
    ? await verifyPassword(joinCode, college.studentJoinCodeHash)
    : await verifyAgainstDummy(joinCode);
  const domain = input.email.split('@')[1];

  if (!college || !joinCodeMatches || !college.emailDomains.includes(domain)) throw registrationRejected();
  if (!college.branches.includes(input.branch)) {
    throw new AppError(400, 'VALIDATION_ERROR', 'Invalid request: branch: is not offered by this college');
  }
  if (await User.exists({ email: input.email })) throw emailTaken();

  let user;
  try {
    user = await userRepository.forTenant(college._id).create({
      role: ROLES.STUDENT,
      name: input.name,
      email: input.email,
      passwordHash: await hashPassword(input.password),
      year: input.year,
      branch: input.branch,
      mustChangePassword: false,
      lastLoginAt: new Date(),
    });
  } catch (err) {
    if (isDuplicateKey(err)) throw emailTaken();
    throw err;
  }

  await audit.record({
    collegeId: college._id,
    actor: { id: user._id, role: user.role },
    action: 'auth.register',
    entityType: 'user',
    entityId: user._id,
    metadata: { year: user.year, branch: user.branch },
    ip,
  });

  return { user: toSafeUser(user), session: sessionClaims(user) };
}

async function login({ email, password }) {
  const user = await User.findOne({ email }).select('+passwordHash');
  const passwordMatches = user ? await verifyPassword(password, user.passwordHash) : await verifyAgainstDummy(password);

  // Unknown email, wrong password, disabled account and suspended college look identical.
  if (!user || !passwordMatches || user.status !== 'active') throw invalidCredentials();
  if (user.collegeId && !(await isCollegeActive(user.collegeId))) throw invalidCredentials();

  user.lastLoginAt = new Date();
  await updateOwnUser(user, { $set: { lastLoginAt: user.lastLoginAt } });

  return { user: toSafeUser(user), session: sessionClaims(user) };
}

/**
 * Turn verified JWT claims into the current safe user, or null when the session is no longer valid
 * (user removed or disabled, password changed, or college suspended).
 */
async function resolveSessionUser(claims) {
  if (!claims || !mongoose.isValidObjectId(claims.sub)) return null;
  const user = await User.findById(claims.sub).lean();
  if (!user || user.status !== 'active' || user.tokenVersion !== claims.tv) return null;
  if (user.collegeId && !(await isCollegeActive(user.collegeId))) return null;
  return toSafeUser(user);
}

async function getCollegeSummary(collegeId) {
  if (!collegeId) return null;
  const college = await College.findById(collegeId).select('name code branches').lean();
  if (!college) return null;
  return { id: idOf(college._id), name: college.name, code: college.code, branches: college.branches };
}

async function getCurrentSession(sessionUser) {
  return { user: sessionUser, college: await getCollegeSummary(sessionUser.collegeId) };
}

async function changePassword(sessionUser, { currentPassword, newPassword }, { ip }) {
  const user = await User.findById(sessionUser.id).select('+passwordHash');
  if (!user) throw new AppError(401, 'UNAUTHENTICATED', 'Authentication required');

  if (!(await verifyPassword(currentPassword, user.passwordHash))) {
    throw new AppError(400, 'INVALID_CURRENT_PASSWORD', 'Current password is incorrect');
  }
  if (await verifyPassword(newPassword, user.passwordHash)) {
    throw new AppError(400, 'VALIDATION_ERROR', 'Invalid request: newPassword: must differ from the current password');
  }

  await updateOwnUser(user, {
    $set: { passwordHash: await hashPassword(newPassword), mustChangePassword: false },
    // Invalidates every existing session for this user.
    $inc: { tokenVersion: 1 },
  });
  const updated = await User.findById(user._id).lean();

  await audit.record({
    collegeId: updated.collegeId,
    actor: { id: updated._id, role: updated.role },
    action: 'auth.password_change',
    entityType: 'user',
    entityId: updated._id,
    metadata: { wasTemporary: Boolean(user.mustChangePassword) },
    ip,
  });

  return { user: toSafeUser(updated), session: sessionClaims(updated) };
}

module.exports = { register, login, resolveSessionUser, getCollegeSummary, getCurrentSession, changePassword };
