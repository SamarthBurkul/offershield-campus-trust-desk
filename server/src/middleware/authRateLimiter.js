'use strict';

const { createRateLimiter } = require('./rateLimiter');

/**
 * Stricter per-IP limiter for POST /auth/login and POST /auth/register (credential guessing,
 * join-code guessing). Each call creates an independent counter store.
 * @param {{ windowMs: number, max: number }} options
 */
function createAuthRateLimiter({ windowMs, max }) {
  return createRateLimiter({ windowMs, max, message: 'Too many attempts, please try again later' });
}

module.exports = { createAuthRateLimiter };
