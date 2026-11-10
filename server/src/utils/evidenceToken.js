'use strict';

const { createHmac } = require('node:crypto');
const jwt = require('jsonwebtoken');

const ALGORITHM = 'HS256';
const PURPOSE = 'evidence';
// A key separate from the session key: an evidence link can never be used as a session and vice versa.
const KEY_LABEL = 'offershield:evidence-link:v1';

function linkSecret(config) {
  if (!config.jwtSecret) throw new Error('JWT secret is not configured');
  return createHmac('sha256', config.jwtSecret).update(KEY_LABEL).digest();
}

/** @returns {{ token: string, expiresAt: Date }} */
function signEvidenceLink({ evidenceId, caseId, userId }, config) {
  const ttl = config.evidenceLinkTtlSeconds;
  const token = jwt.sign(
    { eid: String(evidenceId), cid: String(caseId), uid: String(userId), purpose: PURPOSE },
    linkSecret(config),
    { algorithm: ALGORITHM, expiresIn: ttl },
  );
  return { token, expiresAt: new Date(jwt.decode(token).exp * 1000) };
}

/** Verified payload, or null for any expired, tampered or wrong-purpose token. */
function verifyEvidenceLink(token, config) {
  try {
    const payload = jwt.verify(token, linkSecret(config), { algorithms: [ALGORITHM] });
    return payload.purpose === PURPOSE && payload.eid && payload.cid && payload.uid ? payload : null;
  } catch (err) {
    if (err instanceof jwt.JsonWebTokenError) return null;
    throw err;
  }
}

module.exports = { signEvidenceLink, verifyEvidenceLink };
