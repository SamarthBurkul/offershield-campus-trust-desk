'use strict';

const { generateKeyPairSync, createSign, randomUUID } = require('node:crypto');
const google = require('../../src/services/oauth/google');

// Test-only Google client settings (never real credentials).
const GOOGLE_TEST_ENV = Object.freeze({
  GOOGLE_CLIENT_ID: 'test-client-id.apps.googleusercontent.com',
  GOOGLE_CLIENT_SECRET: 'test-client-secret-value',
  APP_BASE_URL: 'http://localhost:5173',
});

const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
const KID = 'test-key-1';
const jwk = { ...publicKey.export({ format: 'jwk' }), kid: KID, alg: 'RS256', use: 'sig' };

const b64 = (value) => Buffer.from(JSON.stringify(value)).toString('base64url');

/** Sign an ID token with the test key (override any claim, or the header). */
function signIdToken(claims, { header = {}, key = privateKey } = {}) {
  const now = Math.floor(Date.now() / 1000);
  const fullHeader = { alg: 'RS256', kid: KID, typ: 'JWT', ...header };
  const payload = {
    iss: 'https://accounts.google.com',
    aud: GOOGLE_TEST_ENV.GOOGLE_CLIENT_ID,
    sub: 'google-sub-1',
    email: 'new.student@alpha.test.edu',
    email_verified: true,
    name: 'New Student',
    iat: now,
    exp: now + 3600,
    ...claims,
  };
  const input = `${b64(fullHeader)}.${b64(payload)}`;
  const signature = createSign('RSA-SHA256').update(input).sign(key).toString('base64url');
  return `${input}.${signature}`;
}

/**
 * Replace global fetch: the token endpoint returns an ID token built by `tokenFor({ body })`
 * (it receives the posted form so the nonce can be echoed), and the JWKS endpoint returns the test key.
 * Any other URL fails the test. Returns the jest mock.
 */
function mockGoogleFetch({ claims = {}, tokenStatus = 200, idToken } = {}) {
  google.resetKeyCache();
  const calls = [];
  const mock = jest.spyOn(globalThis, 'fetch').mockImplementation(async (url, init = {}) => {
    calls.push({ url: String(url), init });
    if (String(url) === google.TOKEN_URL) {
      if (tokenStatus !== 200) return new Response('{}', { status: tokenStatus });
      const token = idToken ?? signIdToken({ nonce: mockGoogleFetch.lastNonce, ...claims });
      return new Response(JSON.stringify({ id_token: token, access_token: 'unused', token_type: 'Bearer' }), { status: 200 });
    }
    if (String(url) === google.JWKS_URL) return new Response(JSON.stringify({ keys: [jwk] }), { status: 200 });
    throw new Error(`Unexpected network call in test: ${url}`);
  });
  mock.calls = calls;
  return mock;
}
mockGoogleFetch.lastNonce = null;

/** Cookie header value from a supertest response for one cookie name. */
function cookieFrom(res, name) {
  const header = (res.headers['set-cookie'] || []).find((cookie) => cookie.startsWith(`${name}=`) && !cookie.startsWith(`${name}=;`));
  return header ? header.split(';')[0] : undefined;
}

/** Run /start with a supertest agent and remember the nonce/state for the mocked token endpoint. */
async function startGoogle(agent, intent = 'register') {
  const res = await agent.get(`/api/v1/auth/google/start?intent=${intent}`);
  const location = new URL(res.headers.location);
  mockGoogleFetch.lastNonce = location.searchParams.get('nonce');
  return { res, state: location.searchParams.get('state'), location };
}

module.exports = { GOOGLE_TEST_ENV, signIdToken, mockGoogleFetch, cookieFrom, startGoogle, jwk, randomUUID };
