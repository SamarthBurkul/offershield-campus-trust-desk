'use strict';

const AppError = require('../utils/AppError');

/**
 * Resolve the tenant for college routes from the authenticated user only
 * (never from the body, params or query). The super admin has no tenant and is refused.
 */
function requireTenant(req, _res, next) {
  if (!req.user) throw new AppError(401, 'UNAUTHENTICATED', 'Authentication required');
  if (req.user.role === 'super_admin' || !req.user.collegeId) {
    throw new AppError(403, 'FORBIDDEN', 'This area is only available to college accounts');
  }
  req.tenant = Object.freeze({ collegeId: req.user.collegeId });
  next();
}

module.exports = { requireTenant };
