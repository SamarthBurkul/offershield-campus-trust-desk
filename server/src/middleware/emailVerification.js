'use strict';

const AppError = require('../utils/AppError');
const { routeKey } = require('./pendingApproval');

// The only requests an account with an unverified email may make.
const ALLOWED = new Set([
  'GET /auth/me',
  'POST /auth/logout',
  'POST /auth/change-password',
  'POST /auth/verify-email',
  'POST /auth/resend-verification',
]);

/**
 * When REQUIRE_EMAIL_VERIFICATION is on, a password-registered student must confirm the emailed
 * code before reaching anything else. Students only: staff and super-admin accounts are created by
 * a person who hands over the temporary password, so they are never gated. Must run after authenticate.
 */
function enforceEmailVerified(req, _res, next) {
  const required = Boolean(req.app?.locals?.config?.email?.requireVerification);
  if (req.user?.role === 'student' && req.user.emailVerified === false && required && !ALLOWED.has(routeKey(req))) {
    throw new AppError(403, 'EMAIL_NOT_VERIFIED', 'Verify your email address first');
  }
  next();
}

module.exports = { enforceEmailVerified, EMAIL_VERIFICATION_ALLOWED: ALLOWED };
