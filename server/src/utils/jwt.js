'use strict';

const jwt = require('jsonwebtoken');

const SESSION_COOKIE = 'os_session';
const ALGORITHM = 'HS256';

function requireSecret(config) {
  // Internal error (500): the server is misconfigured, not the client.
  if (!config.jwtSecret) throw new Error('JWT secret is not configured');
  return config.jwtSecret;
}

/**
 * @param {{ id: string, role: string, collegeId: string | null, tokenVersion: number }} user
 */
function signSessionToken(user, config) {
  return jwt.sign(
    { sub: user.id, role: user.role, collegeId: user.collegeId, tv: user.tokenVersion },
    requireSecret(config),
    { algorithm: ALGORITHM, expiresIn: config.jwtExpiresInSeconds },
  );
}

/** Returns the verified payload, or null for any invalid, expired or tampered token. */
function verifySessionToken(token, config) {
  try {
    return jwt.verify(token, requireSecret(config), { algorithms: [ALGORITHM] });
  } catch (err) {
    if (err instanceof jwt.JsonWebTokenError) return null;
    throw err;
  }
}

function sessionCookieOptions(config) {
  return {
    httpOnly: true,
    sameSite: 'lax',
    secure: config.cookieSecure,
    path: '/',
  };
}

function setSessionCookie(res, token, config) {
  res.cookie(SESSION_COOKIE, token, { ...sessionCookieOptions(config), maxAge: config.jwtExpiresInSeconds * 1000 });
}

function clearSessionCookie(res, config) {
  res.clearCookie(SESSION_COOKIE, sessionCookieOptions(config));
}

module.exports = { SESSION_COOKIE, signSessionToken, verifySessionToken, setSessionCookie, clearSessionCookie };
