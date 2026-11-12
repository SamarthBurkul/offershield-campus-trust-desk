'use strict';

const AppError = require('../utils/AppError');

const API_PREFIX = '/api/v1';
// The only requests a restricted account (temporary password, or awaiting approval) may make.
const ALLOWED = new Set(['GET /auth/me', 'POST /auth/change-password', 'POST /auth/logout']);

/** "METHOD /path" relative to /api/v1, without the query string or a trailing slash. */
function routeKey(req) {
  const path = req.originalUrl.split('?')[0].replace(/\/+$/, '');
  const relative = path.startsWith(API_PREFIX) ? path.slice(API_PREFIX.length) : path;
  return `${req.method} ${relative}`;
}

const isAllowedWhileRestricted = (req) => ALLOWED.has(routeKey(req));

/**
 * A student registered in a manual_approval college can sign in but reaches nothing else until
 * a placement officer or TPO head approves the account. Must run after authenticate.
 */
function enforceApproved(req, _res, next) {
  if (req.user?.status === 'pending_approval' && !isAllowedWhileRestricted(req)) {
    throw new AppError(403, 'ACCOUNT_PENDING_APPROVAL', 'Your placement cell has not approved your account yet');
  }
  next();
}

module.exports = { enforceApproved, isAllowedWhileRestricted };
