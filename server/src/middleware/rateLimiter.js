'use strict';

const { rateLimit } = require('express-rate-limit');

/**
 * Per-IP limiter answering 429 with the standard error envelope.
 * @param {{ windowMs: number, max: number, message?: string }} options
 */
function createRateLimiter({ windowMs, max, message = 'Too many requests, please try again later' }) {
  return rateLimit({
    windowMs,
    limit: max,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    handler: (_req, res) => {
      res.status(429).json({ error: { code: 'RATE_LIMITED', message } });
    },
  });
}

/**
 * Baseline per-IP limiter for all /api traffic. Login and registration
 * also have a stricter limiter (authRateLimiter.js).
 * @param {{ windowMs: number, max: number }} options
 */
function createApiRateLimiter({ windowMs, max }) {
  return createRateLimiter({ windowMs, max });
}

module.exports = { createRateLimiter, createApiRateLimiter };
