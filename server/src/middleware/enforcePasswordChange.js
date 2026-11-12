'use strict';

const AppError = require('../utils/AppError');
const { enforceApproved, isAllowedWhileRestricted } = require('./pendingApproval');

/**
 * Account-state gate applied by every authenticated router (must run after authenticate):
 * a temporary password must be changed first, then a pending account must be approved.
 */
function enforcePasswordChange(req, res, next) {
  if (req.user?.mustChangePassword && !isAllowedWhileRestricted(req)) {
    throw new AppError(403, 'PASSWORD_CHANGE_REQUIRED', 'You must change your temporary password first');
  }
  enforceApproved(req, res, next);
}

module.exports = { enforcePasswordChange };
