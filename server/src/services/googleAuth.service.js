'use strict';

const AppError = require('../utils/AppError');
const { College } = require('../models/College');
const { User, ROLES } = require('../models/User');
const { userRepository } = require('../repositories');
const { verifyPassword, verifyAgainstDummy } = require('../utils/password');
const { normalizeJoinCode } = require('../utils/tokens');
const { toSafeUser, idOf } = require('../utils/safeUser');
const audit = require('./audit.service');
const notifications = require('./notifications/notify');
const { POLICIES_VERSION } = require('../constants/policies');

// Fixed post-sign-in destinations (never taken from the request: no open redirect).
const ROLE_HOME = Object.freeze({
  [ROLES.STUDENT]: '/student',
  [ROLES.PLACEMENT_OFFICER]: '/staff',
  [ROLES.TPO_HEAD]: '/staff',
  [ROLES.SUPER_ADMIN]: '/admin',
});

const registrationRejected = () =>
  new AppError(400, 'REGISTRATION_REJECTED', 'Registration could not be completed. Check your college details.');
const emailTaken = () => new AppError(409, 'EMAIL_TAKEN', 'An account with this email already exists');

const sessionClaims = (user) => ({ id: idOf(user._id), role: user.role, collegeId: idOf(user.collegeId), tokenVersion: user.tokenVersion });

const updateUser = (user, update) =>
  user.collegeId
    ? userRepository.forTenant(user.collegeId).updateOne({ _id: user._id }, update)
    : User.updateOne({ _id: user._id, role: ROLES.SUPER_ADMIN }, update);

async function collegeIsActive(collegeId) {
  if (!collegeId) return true;
  const college = await College.findById(collegeId).select('status').lean();
  return college?.status === 'active';
}

/**
 * Resolve verified Google claims to an outcome:
 *   { kind: 'session', session, redirect }   signed in (or pending approval)
 *   { kind: 'unavailable' }                   disabled or rejected account
 *   { kind: 'failed' }                        suspended college or a conflicting Google account
 *   { kind: 'signup' }                        no account yet
 * An existing account with the same (Google-verified) email is linked on first use.
 */
async function resolveGoogleUser(identity, { ip }) {
  let user = await User.findOne({ googleSub: identity.sub }).lean();
  if (!user) {
    const byEmail = await User.findOne({ email: identity.email }).lean();
    if (byEmail) {
      // A different Google account already owns this OfferShield account.
      if (byEmail.googleSub && byEmail.googleSub !== identity.sub) return { kind: 'failed' };
      if (['disabled', 'rejected'].includes(byEmail.status)) return { kind: 'unavailable' };
      if (!(await collegeIsActive(byEmail.collegeId))) return { kind: 'failed' };
      await updateUser(byEmail, {
        $set: { googleSub: identity.sub, ...(byEmail.emailVerifiedAt ? {} : { emailVerifiedAt: new Date() }) },
        $addToSet: { authMethods: 'google' },
      });
      await audit.record({
        collegeId: byEmail.collegeId,
        actor: { id: byEmail._id, role: byEmail.role },
        action: 'auth.google_linked',
        entityType: 'user',
        entityId: byEmail._id,
        metadata: { emailWasVerified: Boolean(byEmail.emailVerifiedAt) },
        ip,
      });
      user = await User.findById(byEmail._id).lean();
    }
  }
  if (!user) return { kind: 'signup' };
  if (['disabled', 'rejected'].includes(user.status)) return { kind: 'unavailable' };
  if (!(await collegeIsActive(user.collegeId))) return { kind: 'failed' };

  await updateUser(user, { $set: { lastLoginAt: new Date() } });
  const redirect = user.status === 'pending_approval' ? '/pending-approval' : (ROLE_HOME[user.role] ?? '/');
  return { kind: 'session', session: sessionClaims(user), redirect };
}

/**
 * Create a student from a pending Google sign-up and the college details the student entered.
 * Same checks as password registration; in email_domain colleges the Google address (or the
 * Workspace domain `hd`) must be one of the college's domains.
 */
async function completeGoogleRegistration(pending, input, { ip }) {
  const college = await College.findOne({ code: input.collegeCode, status: 'active' }).select('+studentJoinCodeHash');
  const joinCode = normalizeJoinCode(input.joinCode);
  const joinCodeMatches = college ? await verifyPassword(joinCode, college.studentJoinCodeHash) : await verifyAgainstDummy(joinCode);
  const manualApproval = college?.studentVerification === 'manual_approval';
  const domain = pending.email.split('@')[1];
  const domainAllowed = college && (college.emailDomains.includes(domain) || (pending.hd && college.emailDomains.includes(pending.hd)));

  if (!college || !joinCodeMatches || (!manualApproval && !domainAllowed)) throw registrationRejected();
  if (!college.branches.includes(input.branch)) {
    throw new AppError(400, 'VALIDATION_ERROR', 'Invalid request: branch: is not offered by this college');
  }
  if (await User.exists({ $or: [{ email: pending.email }, { googleSub: pending.sub }] })) throw emailTaken();

  const now = new Date();
  let user;
  try {
    user = await userRepository.forTenant(college._id).create({
      role: ROLES.STUDENT,
      name: pending.name,
      email: pending.email,
      passwordHash: null,
      authMethods: ['google'],
      googleSub: pending.sub,
      emailVerifiedAt: now,
      year: input.year,
      branch: input.branch,
      mustChangePassword: false,
      status: manualApproval ? 'pending_approval' : 'active',
      lastLoginAt: now,
      policiesAcceptedAt: now,
      policiesVersion: POLICIES_VERSION,
    });
  } catch (err) {
    if (err && err.code === 11000) throw emailTaken();
    throw err;
  }

  await audit.record({
    collegeId: college._id,
    actor: { id: user._id, role: user.role },
    action: 'auth.google_register',
    entityType: 'user',
    entityId: user._id,
    metadata: { year: user.year, branch: user.branch, status: user.status, policiesVersion: POLICIES_VERSION },
    ip,
  });

  if (manualApproval) {
    await notifications.notifySafely(college._id, await notifications.activeStaffIds(college._id), {
      type: 'student_pending',
      context: {},
      link: '/staff/students',
      refType: 'user',
      refId: user._id,
    });
  }

  return { user: toSafeUser(user), session: sessionClaims(user) };
}

module.exports = { resolveGoogleUser, completeGoogleRegistration, ROLE_HOME };
