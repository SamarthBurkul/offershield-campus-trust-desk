'use strict';

const { createRateLimiter } = require('./rateLimiter');

const HOUR_MS = 60 * 60 * 1000;

/**
 * Per-user limit on POST /cases (CASE_CREATE_LIMIT_PER_HOUR). Must run after authenticate,
 * so the key is the account, not the IP (students on one campus network share IPs).
 */
function createCaseRateLimiter({ maxPerHour }) {
  return createRateLimiter({
    windowMs: HOUR_MS,
    max: maxPerHour,
    message: 'You have submitted many requests in the last hour. Please try again later.',
    keyGenerator: (req) => `user:${req.user.id}`,
  });
}

module.exports = { createCaseRateLimiter };
