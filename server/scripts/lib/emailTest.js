'use strict';

const { z } = require('zod');
const { createBrevoProvider } = require('../../src/services/email/brevoProvider');

const addressSchema = z.string().trim().toLowerCase().max(254).pipe(z.email());

/**
 * Send one plain test email through the configured provider (no database needed).
 * Resolves to { ok: true, messageId } or { ok: false, errorCode, providerStatus } — nothing else,
 * so the caller can print the result without risking the key, the address or the body.
 */
async function runEmailTest({ config, to, fetchImpl }) {
  if (config.email.provider !== 'brevo') {
    return { ok: false, errorCode: 'PROVIDER_IS_LOG', providerStatus: null };
  }
  const parsed = addressSchema.safeParse(to ?? '');
  if (!parsed.success) return { ok: false, errorCode: 'INVALID_TO_ADDRESS', providerStatus: null };

  const provider = createBrevoProvider({ apiKey: config.email.brevoApiKey, from: config.email.from, fromName: config.email.fromName, fetchImpl });
  try {
    const { messageId } = await provider.send({
      to: parsed.data,
      subject: 'OfferShield test email',
      text: 'This is a test email from OfferShield (npm run ops:email-test). No action is needed.',
      html: '<p>This is a test email from OfferShield (npm run ops:email-test). No action is needed.</p>',
    });
    return { ok: true, messageId };
  } catch (err) {
    return { ok: false, errorCode: String(err?.code ?? 'ERROR').slice(0, 40), providerStatus: Number.isInteger(err?.providerStatus) ? err.providerStatus : null };
  }
}

/** The only lines the script prints. */
const formatResult = (result) => (result.ok ? `ok messageId=${result.messageId ?? '-'}` : `errorCode=${result.errorCode} providerStatus=${result.providerStatus ?? '-'}`);

module.exports = { runEmailTest, formatResult };
