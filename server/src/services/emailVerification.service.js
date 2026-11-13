'use strict';

const { createHmac, randomInt, timingSafeEqual } = require('node:crypto');
const AppError = require('../utils/AppError');
const { User } = require('../models/User');
const { userRepository } = require('../repositories');
const { toSafeUser } = require('../utils/safeUser');
const audit = require('./audit.service');
const email = require('./email');

const OTP_TTL_MS = 10 * 60 * 1000;
const OTP_MAX_ATTEMPTS = 5;
const RESEND_COOLDOWN_MS = 60 * 1000;
const RESEND_MAX_PER_HOUR = 5;
const HOUR_MS = 60 * 60 * 1000;
const KEY_LABEL = 'offershield:email-otp:v1';

const invalidCode = () => new AppError(400, 'INVALID_CODE', 'That code is not valid or has expired. Request a new code.');

// Separate key per purpose, derived from JWT_SECRET (no extra secret to manage).
const otpKey = (config) => createHmac('sha256', config.jwtSecret).update(KEY_LABEL).digest();

/** HMAC of the code bound to the user id, so a stored hash is useless for any other account. */
function hashCode(config, userId, code) {
  return createHmac('sha256', otpKey(config)).update(`${String(userId)}:${code}`).digest('hex');
}

const generateCode = () => String(randomInt(0, 1_000_000)).padStart(6, '0');

/**
 * Create a fresh code for the user, store only its HMAC and send it (in the background).
 * @param {object} user user document or lean record with _id, collegeId, email, name
 * @param {object} config app config (jwtSecret)
 * @param {Date[]} [previousSends] send times kept for the hourly cap
 */
async function issueCode(user, config, previousSends = [], now = new Date()) {
  const code = generateCode();
  const sentAt = [...previousSends.filter((at) => now - new Date(at) < HOUR_MS), now];
  await userRepository.forTenant(user.collegeId).updateOne(
    { _id: user._id },
    { $set: { emailOtp: { hash: hashCode(config, user._id, code), expiresAt: new Date(now.getTime() + OTP_TTL_MS), attempts: 0, lastSentAt: now, sentAt } } },
  );
  email.sendEmailLater({ _id: user._id, collegeId: user.collegeId, email: user.email, name: user.name }, 'verify_email', { code });
}

async function loadWithOtp(sessionUser) {
  const user = await userRepository.forTenant(sessionUser.collegeId).findOne({ _id: sessionUser.id }, { select: '+emailOtp' });
  if (!user) throw new AppError(401, 'UNAUTHENTICATED', 'Authentication required');
  return user;
}

async function verifyEmail(sessionUser, { code }, { config, ip }) {
  if (!sessionUser.collegeId) throw invalidCode();
  const user = await loadWithOtp(sessionUser);
  if (user.emailVerifiedAt) return toSafeUser(user);

  const otp = user.emailOtp;
  if (!otp || otp.expiresAt <= new Date() || otp.attempts >= OTP_MAX_ATTEMPTS) throw invalidCode();

  // Count the attempt first (atomically), so parallel guesses cannot exceed the cap.
  const repo = userRepository.forTenant(user.collegeId);
  const counted = await repo.updateOne(
    { _id: user._id, 'emailOtp.hash': otp.hash, 'emailOtp.attempts': { $lt: OTP_MAX_ATTEMPTS } },
    { $inc: { 'emailOtp.attempts': 1 } },
  );
  if (counted.modifiedCount === 0) throw invalidCode();

  const expected = Buffer.from(otp.hash, 'hex');
  const actual = Buffer.from(hashCode(config, user._id, code), 'hex');
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) throw invalidCode();

  const verifiedAt = new Date();
  await repo.updateOne({ _id: user._id }, { $set: { emailVerifiedAt: verifiedAt }, $unset: { emailOtp: 1 } });
  await audit.record({
    collegeId: user.collegeId,
    actor: { id: user._id, role: user.role },
    action: 'auth.email_verified',
    entityType: 'user',
    entityId: user._id,
    metadata: { method: 'otp' },
    ip,
  });
  const updated = await User.findById(user._id).lean();
  return toSafeUser(updated);
}

async function resendVerification(sessionUser, { config }) {
  if (!sessionUser.collegeId) return { sent: false, retryAfterSeconds: 0 };
  const user = await loadWithOtp(sessionUser);
  if (user.emailVerifiedAt) return { sent: false, retryAfterSeconds: 0 };

  const now = new Date();
  const otp = user.emailOtp;
  if (otp?.lastSentAt && now - otp.lastSentAt < RESEND_COOLDOWN_MS) {
    const retryAfterSeconds = Math.ceil((RESEND_COOLDOWN_MS - (now - otp.lastSentAt)) / 1000);
    throw new AppError(429, 'RESEND_TOO_SOON', `Please wait ${retryAfterSeconds} seconds before asking for a new code`, { retryAfterSeconds });
  }
  const recent = (otp?.sentAt ?? []).filter((at) => now - at < HOUR_MS);
  if (recent.length >= RESEND_MAX_PER_HOUR) {
    throw new AppError(429, 'RESEND_LIMIT', 'Too many codes requested. Try again in an hour.', { retryAfterSeconds: 3600 });
  }
  await issueCode(user, config, recent, now);
  return { sent: true, retryAfterSeconds: RESEND_COOLDOWN_MS / 1000 };
}

module.exports = {
  issueCode,
  verifyEmail,
  resendVerification,
  hashCode,
  OTP_TTL_MS,
  OTP_MAX_ATTEMPTS,
  RESEND_COOLDOWN_MS,
  RESEND_MAX_PER_HOUR,
};
