'use strict';

const { createRateLimiter, ipKey } = require('./rateLimiter');

const MESSAGE = 'Too many attempts, please try again later';

const normalisedEmail = (req) => String(req.body?.email ?? '').trim().toLowerCase().slice(0, 254);

/**
 * POST /auth/login: a tight limit per IP + email (password guessing against one account) and a
 * looser per-IP ceiling, so a whole campus behind one public IP can still sign in.
 * Each call creates independent counter stores. Must run after the JSON body parser.
 * @param {{ windowMs: number, max: number, ipMax: number }} options
 */
function createLoginRateLimiters({ windowMs, max, ipMax }) {
  return [
    createRateLimiter({ windowMs, max: ipMax, message: MESSAGE }),
    createRateLimiter({ windowMs, max, message: MESSAGE, keyGenerator: (req) => `${ipKey(req)}|email:${normalisedEmail(req)}` }),
  ];
}

/**
 * POST /auth/register: per IP (join-code guessing).
 * @param {{ windowMs: number, max: number }} options
 */
function createRegisterRateLimiter({ windowMs, max }) {
  return createRateLimiter({ windowMs, max, message: MESSAGE });
}

module.exports = { createLoginRateLimiters, createRegisterRateLimiter };
