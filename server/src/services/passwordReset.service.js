'use strict';

const { createHash, randomBytes } = require('node:crypto');
const AppError = require('../utils/AppError');
const { User } = require('../models/User');
const { College } = require('../models/College');
const { PasswordResetToken, RESET_TOKEN_TTL_MS, MAX_ACTIVE_RESET_TOKENS } = require('../models/PasswordResetToken');
const { userRepository } = require('../repositories');
const { hashPassword } = require('../utils/password');
const audit = require('./audit.service');
const email = require('./email');

const invalidToken = () => new AppError(400, 'INVALID_TOKEN', 'This reset link is invalid or has expired. Request a new one.');

const sha256 = (value) => createHash('sha256').update(String(value)).digest('hex');

async function collegeIsActive(collegeId) {
  if (!collegeId) return true;
  const college = await College.findById(collegeId).select('status').lean();
  return college?.status === 'active';
}

/**
 * The work behind POST /auth/forgot-password. Runs in the background so every request gets the same
 * 202 at the same speed whether or not the address exists.
 *  - active, verified password account: a one-time link (30 minutes)
 *  - Google-only account: a "use Continue with Google" email
 *  - anything else: nothing
 */
async function processForgotPassword(rawEmail, { baseUrl }) {
  const address = String(rawEmail).trim().toLowerCase();
  const user = await User.findOne({ email: address }).select('+passwordHash').lean();
  if (!user || user.status !== 'active' || !(await collegeIsActive(user.collegeId))) return 'ignored';
  const recipient = { _id: user._id, collegeId: user.collegeId, email: user.email, name: user.name };

  if (!user.passwordHash) {
    if ((user.authMethods ?? []).includes('google')) {
      await email.sendEmail(recipient, 'password_reset_google', {});
      return 'google';
    }
    return 'ignored';
  }
  if (!user.emailVerifiedAt) return 'ignored';

  const now = new Date();
  const active = await PasswordResetToken.countDocuments({ userId: user._id, usedAt: null, expiresAt: { $gt: now } });
  if (active >= MAX_ACTIVE_RESET_TOKENS) return 'limit';

  const token = randomBytes(32).toString('base64url');
  await PasswordResetToken.create({ userId: user._id, tokenHash: sha256(token), expiresAt: new Date(now.getTime() + RESET_TOKEN_TTL_MS) });
  // The token travels in the URL fragment, so it never reaches a server log or a Referer header.
  const link = `${String(baseUrl).replace(/\/+$/, '')}/reset-password#token=${token}`;
  await email.sendEmail(recipient, 'password_reset', { link });
  return 'sent';
}

/** Accepts the request and schedules the work; never reveals whether the address exists. */
function requestReset({ email: address }) {
  if (!email.isEmailEnabled()) return;
  email.runInBackground(() => processForgotPassword(address, { baseUrl: email.getBaseUrl() }));
}

async function resetPassword({ token, newPassword }, { ip }) {
  const now = new Date();
  // Claim the token atomically: a second use (or a parallel one) finds nothing.
  const claimed = await PasswordResetToken.findOneAndUpdate(
    { tokenHash: sha256(token), usedAt: null, expiresAt: { $gt: now } },
    { $set: { usedAt: now } },
    { returnDocument: 'after' },
  );
  if (!claimed) throw invalidToken();

  const user = await User.findById(claimed.userId).select('+passwordHash').lean();
  if (!user || user.status !== 'active' || !user.passwordHash || !(await collegeIsActive(user.collegeId))) throw invalidToken();

  await userRepository.forTenant(user.collegeId).updateOne(
    { _id: user._id },
    // Every existing session ends; a temporary-password requirement is satisfied by the new password.
    { $set: { passwordHash: await hashPassword(newPassword), mustChangePassword: false }, $inc: { tokenVersion: 1 } },
  );
  // Any other outstanding links for this account stop working.
  await PasswordResetToken.updateMany({ userId: user._id, usedAt: null }, { $set: { usedAt: now } });

  await audit.record({
    collegeId: user.collegeId,
    actor: { id: user._id, role: user.role },
    action: 'auth.password_reset_self',
    entityType: 'user',
    entityId: user._id,
    metadata: { wasTemporary: Boolean(user.mustChangePassword) },
    ip,
  });
  email.sendEmailLater({ _id: user._id, collegeId: user.collegeId, email: user.email, name: user.name }, 'password_changed', {});
}

module.exports = { processForgotPassword, requestReset, resetPassword, sha256 };
