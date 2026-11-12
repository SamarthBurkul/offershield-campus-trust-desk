'use strict';

const { rateLimit, ipKeyGenerator } = require('express-rate-limit');
const { SESSION_COOKIE, verifySessionToken } = require('../utils/jwt');

/** IP key (IPv6 grouped by /56, so one host cannot rotate addresses). Honours `trust proxy`. */
const ipKey = (req) => `ip:${ipKeyGenerator(req.ip)}`;

/**
 * Limiter answering 429 with the standard error envelope. Per IP unless keyGenerator is given.
 * @param {{ windowMs: number, max: number | ((req: any) => number), message?: string, keyGenerator?: (req: any) => string }} options
 */
function createRateLimiter({ windowMs, max, message = 'Too many requests, please try again later', keyGenerator = ipKey }) {
  return rateLimit({
    windowMs,
    limit: max,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    keyGenerator,
    handler: (_req, res) => {
      res.status(429).json({ error: { code: 'RATE_LIMITED', message } });
    },
  });
}

/**
 * The account behind a verified session cookie, or null. A signature/expiry check only - no database
 * query, so the limiter stays cheap; authenticate still re-validates the session on protected routes.
 */
function sessionSubject(req, config) {
  const token = req.cookies?.[SESSION_COOKIE];
  if (!token || !config.jwtSecret) return null;
  const claims = verifySessionToken(token, config);
  return claims && typeof claims.sub === 'string' ? claims.sub : null;
}

/**
 * Baseline limiter for all /api traffic. Signed-in requests count per account (many students share
 * one campus IP); anonymous requests count per IP. Login and registration have their own limiters.
 * @param {{ windowMs: number, max: number, userMax: number }} limits
 * @param {{ jwtSecret?: string }} config
 */
function createApiRateLimiter({ windowMs, max, userMax }, config) {
  const identify = (req) => {
    req.rateLimitSubject ??= sessionSubject(req, config) ?? false;
    return req.rateLimitSubject;
  };
  return createRateLimiter({
    windowMs,
    max: (req) => (identify(req) ? userMax : max),
    keyGenerator: (req) => (identify(req) ? `user:${identify(req)}` : ipKey(req)),
  });
}

module.exports = { createRateLimiter, createApiRateLimiter, ipKey };
