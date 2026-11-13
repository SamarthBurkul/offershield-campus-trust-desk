'use strict';

const AppError = require('../utils/AppError');
const { enforceApproved, isAllowedWhileRestricted } = require('./pendingApproval');
const { enforceEmailVerified } = require('./emailVerification');

/**
 * Account-state gate applied by every authenticated router (must run after authenticate):
 * the email must be verified first (when required), then a temporary password must be changed,
 * then a pending account must be approved.
 */
function enforcePasswordChange(req, res, next) {
  enforceEmailVerified(req, res, () => {
    if (req.user?.mustChangePassword && !isAllowedWhileRestricted(req)) {
      throw new AppError(403, 'PASSWORD_CHANGE_REQUIRED', 'You must change your temporary password first');
    }
    enforceApproved(req, res, next);
  });
}

module.exports = { enforcePasswordChange };
