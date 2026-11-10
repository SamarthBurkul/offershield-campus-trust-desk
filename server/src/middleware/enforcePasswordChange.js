'use strict';

const AppError = require('../utils/AppError');

const API_PREFIX = '/api/v1';
// The only requests a user with a temporary password may make.
const ALLOWED = new Set(['GET /auth/me', 'POST /auth/change-password', 'POST /auth/logout']);

/** Must run after authenticate. */
function enforcePasswordChange(req, _res, next) {
  if (req.user?.mustChangePassword) {
    const path = req.originalUrl.split('?')[0].replace(/\/+$/, '');
    const relative = path.startsWith(API_PREFIX) ? path.slice(API_PREFIX.length) : path;
    if (!ALLOWED.has(`${req.method} ${relative}`)) {
      throw new AppError(403, 'PASSWORD_CHANGE_REQUIRED', 'You must change your temporary password first');
    }
  }
  next();
}

module.exports = { enforcePasswordChange };
