'use strict';

// Fixed endpoint: the only Brevo URL OfferShield ever calls.
const BREVO_URL = 'https://api.brevo.com/v3/smtp/email';
const TIMEOUT_MS = 10_000;

// Brevo's documented error codes. Only these become an errorCode; the message text is never read.
const BREVO_ERROR_CODES = new Set([
  'unauthorized',
  'permission_denied',
  'invalid_parameter',
  'missing_parameter',
  'not_enough_credits',
  'account_under_validation',
  'duplicate_parameter',
  'duplicate_request',
  'document_not_found',
  'method_not_allowed',
  'not_acceptable',
  'too_many_requests',
]);

class EmailProviderError extends Error {
  constructor(code, retryable, providerStatus = null) {
    super(`Email provider error: ${code}`);
    this.name = 'EmailProviderError';
    this.code = code;
    this.retryable = retryable;
    this.providerStatus = providerStatus;
  }
}

/** BREVO_UNAUTHORIZED etc. from the response's `code` field, else BREVO_<status>. */
async function errorCodeFor(response) {
  const body = await response.json().catch(() => null);
  const code = typeof body?.code === 'string' ? body.code.toLowerCase() : null;
  return code && BREVO_ERROR_CODES.has(code) ? `BREVO_${code.toUpperCase()}` : `BREVO_${response.status}`;
}

async function attempt(payload, { apiKey, fetchImpl }) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  let response;
  try {
    response = await fetchImpl(BREVO_URL, {
      method: 'POST',
      headers: { 'api-key': apiKey, 'content-type': 'application/json', accept: 'application/json' },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
  } catch (err) {
    throw new EmailProviderError(err?.name === 'AbortError' ? 'BREVO_TIMEOUT' : 'BREVO_NETWORK', true);
  } finally {
    clearTimeout(timer);
  }
  if (response.status >= 500) throw new EmailProviderError('BREVO_5XX', true, response.status);
  if (!response.ok) throw new EmailProviderError(await errorCodeFor(response), false, response.status);
  const body = await response.json().catch(() => ({}));
  return { messageId: typeof body?.messageId === 'string' ? body.messageId.slice(0, 200) : null };
}

/**
 * Transactional email through Brevo's HTTP API (no SDK). Retries once on 5xx, network errors and
 * timeouts; never on 4xx. Error messages carry a code only, never the key or the payload.
 */
function createBrevoProvider({ apiKey, from, fromName, fetchImpl = (...args) => globalThis.fetch(...args) }) {
  return {
    name: 'brevo',
    async send({ to, toName, subject, text, html }) {
      const payload = {
        sender: { email: from, name: fromName },
        to: [toName ? { email: to, name: toName } : { email: to }],
        subject,
        textContent: text,
        htmlContent: html,
      };
      try {
        return await attempt(payload, { apiKey, fetchImpl });
      } catch (err) {
        if (!err.retryable) throw err;
        return attempt(payload, { apiKey, fetchImpl });
      }
    },
  };
}

module.exports = { createBrevoProvider, EmailProviderError, BREVO_URL, TIMEOUT_MS, BREVO_ERROR_CODES };
