'use strict';

const { createRateLimiter } = require('./rateLimiter');

/** Per-user limit on GET /lookup (LOOKUP_LIMIT_PER_10MIN). Must run after authenticate. */
function createLookupRateLimiter({ maxPer10Min }) {
  return createRateLimiter({
    windowMs: 10 * 60 * 1000,
    max: maxPer10Min,
    message: 'You have made many lookups recently. Please wait a few minutes and try again.',
    keyGenerator: (req) => `user:${req.user.id}`,
  });
}

module.exports = { createLookupRateLimiter };
