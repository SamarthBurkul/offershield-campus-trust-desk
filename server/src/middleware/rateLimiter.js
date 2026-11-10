'use strict';

const { rateLimit } = require('express-rate-limit');

/**
 * Baseline per-IP limiter for all /api traffic. Stricter limiters for
 * login and submissions are added in later phases.
 * @param {{ windowMs: number, max: number }} options
 */
function createApiRateLimiter({ windowMs, max }) {
  return rateLimit({
    windowMs,
    limit: max,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    handler: (_req, res) => {
      res.status(429).json({
        error: { code: 'RATE_LIMITED', message: 'Too many requests, please try again later' },
      });
    },
  });
}

module.exports = { createApiRateLimiter };
