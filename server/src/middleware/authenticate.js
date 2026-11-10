'use strict';

const AppError = require('../utils/AppError');
const { SESSION_COOKIE, verifySessionToken } = require('../utils/jwt');
const authService = require('../services/auth.service');

const unauthenticated = () => new AppError(401, 'UNAUTHENTICATED', 'Authentication required');

/**
 * Verify the session cookie and load the user from the database on every request, so disabling
 * an account, changing a password or suspending a college takes effect immediately.
 * Sets req.user to the safe user (no hash, no tokenVersion).
 */
function createAuthenticate(config) {
  return async function authenticate(req, _res, next) {
    const token = req.cookies?.[SESSION_COOKIE];
    if (!token) throw unauthenticated();

    const claims = verifySessionToken(token, config);
    const user = claims && (await authService.resolveSessionUser(claims));
    if (!user) throw unauthenticated();

    req.user = user;
    next();
  };
}

module.exports = { createAuthenticate };
