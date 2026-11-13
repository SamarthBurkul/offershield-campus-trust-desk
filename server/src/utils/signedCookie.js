'use strict';

const { createHmac, timingSafeEqual } = require('node:crypto');

const KEY_LABEL = 'offershield:signed-cookie:v1';

const keyFor = (config) => createHmac('sha256', config.jwtSecret).update(KEY_LABEL).digest();
// The cookie name is part of the MAC, so a value from one cookie can never be replayed as another.
const mac = (config, name, payload) => createHmac('sha256', keyFor(config)).update(`${name}.${payload}`).digest('base64url');

/**
 * A short-lived, tamper-proof cookie value: base64url(JSON with exp) + "." + HMAC.
 * Not encrypted: it carries only values that are safe for the user's own browser to hold.
 */
function signValue(config, name, data, ttlMs) {
  const payload = Buffer.from(JSON.stringify({ ...data, exp: Date.now() + ttlMs })).toString('base64url');
  return `${payload}.${mac(config, name, payload)}`;
}

/** The decoded data, or null if missing, tampered, malformed or expired. */
function verifyValue(config, name, value) {
  if (typeof value !== 'string' || value.length > 4096) return null;
  const [payload, signature, extra] = value.split('.');
  if (!payload || !signature || extra !== undefined) return null;
  const expected = Buffer.from(mac(config, name, payload));
  const actual = Buffer.from(signature);
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    if (!data || typeof data !== 'object' || typeof data.exp !== 'number' || data.exp <= Date.now()) return null;
    return data;
  } catch {
    return null;
  }
}

module.exports = { signValue, verifyValue };
