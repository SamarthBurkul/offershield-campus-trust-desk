'use strict';

const AppError = require('../utils/AppError');

/** Allow only the listed roles. Must run after authenticate. */
function requireRole(...roles) {
  return function checkRole(req, _res, next) {
    if (!req.user) throw new AppError(401, 'UNAUTHENTICATED', 'Authentication required');
    if (!roles.includes(req.user.role)) {
      throw new AppError(403, 'FORBIDDEN', 'You do not have permission to perform this action');
    }
    next();
  };
}

module.exports = { requireRole };
