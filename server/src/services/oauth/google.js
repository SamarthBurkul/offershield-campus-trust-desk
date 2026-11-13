'use strict';

const { createHash, createPublicKey, randomBytes, verify } = require('node:crypto');

// Fixed Google endpoints: the only Google URLs OfferShield ever calls or redirects to.
const AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const JWKS_URL = 'https://www.googleapis.com/oauth2/v3/certs';
const ISSUERS = new Set(['accounts.google.com', 'https://accounts.google.com']);
const TIMEOUT_MS = 10_000;
const CLOCK_SKEW_SECONDS = 60;
const JWKS_CACHE_MS = 60 * 60 * 1000;

class GoogleAuthError extends Error {
  constructor(code) {
    super(`Google sign-in failed: ${code}`);
    this.name = 'GoogleAuthError';
    this.code = code;
  }
}

const b64url = (buffer) => Buffer.from(buffer).toString('base64url');
const randomToken = () => b64url(randomBytes(32));

/** PKCE (RFC 7636) with the S256 method. */
function createPkce() {
  const verifier = randomToken();
  return { verifier, challenge: b64url(createHash('sha256').update(verifier).digest()) };
}

function buildAuthUrl({ clientId, redirectUri, state, nonce, challenge }) {
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: 'openid email profile',
    state,
    nonce,
    code_challenge: challenge,
    code_challenge_method: 'S256',
    prompt: 'select_account',
    access_type: 'online',
  });
  return `${AUTH_URL}?${params}`;
}

async function fetchWithTimeout(url, init) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    return await globalThis.fetch(url, { ...init, signal: controller.signal });
  } catch {
    throw new GoogleAuthError('NETWORK');
  } finally {
    clearTimeout(timer);
  }
}

/** Exchange the authorization code (with the PKCE verifier) for the ID token. */
async function exchangeCode({ code, verifier, clientId, clientSecret, redirectUri }) {
  const response = await fetchWithTimeout(TOKEN_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded', accept: 'application/json' },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
      code_verifier: verifier,
    }).toString(),
  });
  if (!response.ok) throw new GoogleAuthError(`TOKEN_${response.status}`);
  const body = await response.json().catch(() => null);
  if (!body || typeof body.id_token !== 'string') throw new GoogleAuthError('TOKEN_RESPONSE');
  return body.id_token;
}

let jwksCache = { keys: null, fetchedAt: 0 };

async function loadKeys(force = false) {
  if (!force && jwksCache.keys && Date.now() - jwksCache.fetchedAt < JWKS_CACHE_MS) return jwksCache.keys;
  const response = await fetchWithTimeout(JWKS_URL, { headers: { accept: 'application/json' } });
  if (!response.ok) throw new GoogleAuthError('JWKS');
  const body = await response.json().catch(() => null);
  if (!body || !Array.isArray(body.keys)) throw new GoogleAuthError('JWKS');
  jwksCache = { keys: body.keys, fetchedAt: Date.now() };
  return body.keys;
}

const resetKeyCache = () => {
  jwksCache = { keys: null, fetchedAt: 0 };
};

function decodePart(part) {
  try {
    return JSON.parse(Buffer.from(part, 'base64url').toString('utf8'));
  } catch {
    throw new GoogleAuthError('MALFORMED');
  }
}

/**
 * Verify a Google ID token: RS256 signature against Google's published keys, issuer, audience,
 * expiry, nonce and email_verified. Returns { sub, email (lowercased), name, hd }.
 */
async function verifyIdToken(idToken, { clientId, nonce }) {
  const parts = String(idToken).split('.');
  if (parts.length !== 3) throw new GoogleAuthError('MALFORMED');
  const header = decodePart(parts[0]);
  const claims = decodePart(parts[1]);
  if (header.alg !== 'RS256' || typeof header.kid !== 'string') throw new GoogleAuthError('ALGORITHM');

  let jwk = (await loadKeys()).find((key) => key.kid === header.kid);
  // Google rotates keys; refresh once when the kid is unknown.
  if (!jwk) jwk = (await loadKeys(true)).find((key) => key.kid === header.kid);
  if (!jwk || jwk.kty !== 'RSA') throw new GoogleAuthError('UNKNOWN_KEY');

  let publicKey;
  try {
    publicKey = createPublicKey({ key: { kty: jwk.kty, n: jwk.n, e: jwk.e }, format: 'jwk' });
  } catch {
    throw new GoogleAuthError('UNKNOWN_KEY');
  }
  const signatureValid = verify('RSA-SHA256', Buffer.from(`${parts[0]}.${parts[1]}`), publicKey, Buffer.from(parts[2], 'base64url'));
  if (!signatureValid) throw new GoogleAuthError('SIGNATURE');

  const now = Math.floor(Date.now() / 1000);
  if (!ISSUERS.has(claims.iss)) throw new GoogleAuthError('ISSUER');
  const audiences = Array.isArray(claims.aud) ? claims.aud : [claims.aud];
  if (!audiences.includes(clientId)) throw new GoogleAuthError('AUDIENCE');
  if (audiences.length > 1 && claims.azp !== clientId) throw new GoogleAuthError('AUDIENCE');
  if (typeof claims.exp !== 'number' || claims.exp + CLOCK_SKEW_SECONDS < now) throw new GoogleAuthError('EXPIRED');
  if (typeof claims.iat === 'number' && claims.iat - CLOCK_SKEW_SECONDS > now) throw new GoogleAuthError('NOT_YET_VALID');
  if (!nonce || claims.nonce !== nonce) throw new GoogleAuthError('NONCE');
  if (claims.email_verified !== true) throw new GoogleAuthError('EMAIL_UNVERIFIED');
  if (typeof claims.sub !== 'string' || !claims.sub || typeof claims.email !== 'string') throw new GoogleAuthError('CLAIMS');

  return {
    sub: claims.sub.slice(0, 255),
    email: claims.email.trim().toLowerCase(),
    name: typeof claims.name === 'string' && claims.name.trim() ? claims.name.trim().slice(0, 120) : claims.email.split('@')[0],
    hd: typeof claims.hd === 'string' ? claims.hd.toLowerCase() : null,
  };
}

// Exposed through an object so tests can replace a step if needed.
module.exports = {
  createPkce,
  randomToken,
  buildAuthUrl,
  exchangeCode,
  verifyIdToken,
  resetKeyCache,
  GoogleAuthError,
  AUTH_URL,
  TOKEN_URL,
  JWKS_URL,
};
