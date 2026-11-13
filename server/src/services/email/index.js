'use strict';

const { EmailLog } = require('../../models/EmailLog');
const { userRepository, advisoryRepository } = require('../../repositories');
const { renderEmail, TEMPLATES } = require('./templates');
const { createLogProvider } = require('./logProvider');
const { createBrevoProvider } = require('./brevoProvider');
const budget = require('./budget');

const FANOUT_BATCH = 50;
const FANOUT_CONCURRENCY = 5;
// In-app notification types that also send an email (others stay in-app only).
const EMAIL_NOTIFICATION_TYPES = new Set(Object.keys(TEMPLATES).filter((type) => TEMPLATES[type].pref));
const EMAIL_ADVISORY_SEVERITIES = new Set(['critical', 'warning']);

/**
 * Module state. createApp() calls configureEmail(config) so deep service code (notifications,
 * password reset) can send without threading config through every call. The last configured
 * app wins, which only matters in tests that build several apps.
 */
const state = {
  settings: null,
  provider: null,
  pending: new Set(),
};

function configureEmail(config, { fetchImpl, sink } = {}) {
  const email = config.email;
  const provider =
    email.provider === 'brevo'
      ? createBrevoProvider({ apiKey: email.brevoApiKey, from: email.from, fromName: email.fromName, fetchImpl })
      : createLogProvider({ nodeEnv: config.nodeEnv, sink });
  state.provider = provider;
  state.settings = {
    // The log provider cannot deliver in production, so email counts as "off" there (Phase 8 behaviour).
    enabled: email.provider === 'brevo' || !config.isProduction,
    dailyBudget: email.dailyBudget,
    requireVerification: email.requireVerification,
    baseUrl: config.appBaseUrl ?? config.clientOrigins?.[0] ?? 'http://localhost:5173',
  };
  return provider;
}

const settings = () => {
  if (!state.settings) {
    // Lazy default for scripts and tests that never built an app.
    configureEmail(require('../../config/env').config);
  }
  return state.settings;
};

const isEmailEnabled = () => settings().enabled;
const isVerificationRequired = () => settings().requireVerification;
const getProvider = () => (settings(), state.provider);
const getBaseUrl = () => settings().baseUrl;

async function writeLog(user, type, priority, status, extra = {}) {
  try {
    await EmailLog.create({ collegeId: user.collegeId ?? null, userId: user._id ?? user.id, type, priority, status, ...extra });
  } catch (err) {
    console.error(`[email] log failed: ${err?.code ?? err?.name ?? 'Error'}`);
  }
}

/**
 * Send one email now. Returns the EmailLog status. Never throws.
 * @param {{ _id: any, email: string, name?: string, collegeId?: any, emailPrefs?: object }} user
 * @param {string} type
 * @param {object} context allow-listed template fields
 */
async function sendEmail(user, type, context = {}, { path } = {}) {
  const config = settings();
  if (!config.enabled) return 'disabled';
  let rendered;
  try {
    rendered = renderEmail(type, { name: user.name, ...context }, { baseUrl: config.baseUrl, path });
  } catch (err) {
    console.error(`[email] render failed: ${err?.name ?? 'Error'}`);
    return 'failed';
  }
  const { priority, pref } = rendered;
  if (pref && user.emailPrefs?.[pref] === false) {
    await writeLog(user, type, priority, 'skipped_pref');
    return 'skipped_pref';
  }
  let release = null;
  try {
    release = await budget.reserve(priority, config.dailyBudget);
    if (!release) {
      await writeLog(user, type, priority, 'skipped_budget');
      return 'skipped_budget';
    }
    const result = await state.provider.send({
      to: user.email,
      toName: user.name,
      subject: rendered.subject,
      text: rendered.text,
      html: rendered.html,
      // Read only by the log provider (development console line).
      devCode: type === 'verify_email' ? context.code : undefined,
      devLink: type === 'password_reset' ? context.link : undefined,
    });
    await writeLog(user, type, priority, 'sent', { providerMessageId: result?.messageId ?? null });
    return 'sent';
  } catch (err) {
    const code = String(err?.code ?? err?.name ?? 'Error').slice(0, 40);
    console.error(`[email] send failed: ${code}`);
    await writeLog(user, type, priority, 'failed', { errorCode: code });
    return 'failed';
  } finally {
    release?.();
  }
}

/** Run work after the response; failures are logged by code only. `flushEmails()` awaits it (tests, scripts). */
function later(work) {
  const promise = new Promise((resolve) => setImmediate(resolve))
    .then(work)
    .catch((err) => console.error(`[email] background failed: ${err?.code ?? err?.name ?? 'Error'}`))
    .finally(() => state.pending.delete(promise));
  state.pending.add(promise);
  return promise;
}

const sendEmailLater = (user, type, context) => later(() => sendEmail(user, type, context));

async function flushEmails() {
  while (state.pending.size) await Promise.all([...state.pending]);
}

async function runLimited(items, limit, worker) {
  const results = [];
  let index = 0;
  const lanes = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (index < items.length) {
      const item = items[index++];
      results.push(await worker(item));
    }
  });
  await Promise.all(lanes);
  return results;
}

/**
 * Email counterpart of an in-app notification. Recipients must be active and verified; others are
 * skipped silently, opted-out users are logged as skipped_pref. Sends in batches of 50 with five at
 * a time and stops once the daily budget is reached. Returns { sent, audience }.
 */
async function emailForNotification(collegeId, userIds, { type, context = {}, link }) {
  const audience = userIds.length;
  let sent = 0;
  const repo = userRepository.forTenant(collegeId);
  for (let i = 0; i < userIds.length; i += FANOUT_BATCH) {
    const users = await repo.find(
      { _id: { $in: userIds.slice(i, i + FANOUT_BATCH) }, status: 'active', emailVerifiedAt: { $ne: null } },
      { select: '_id collegeId name email emailPrefs', lean: true },
    );
    const results = await runLimited(users, FANOUT_CONCURRENCY, (user) => sendEmail(user, type, context, { path: link }));
    sent += results.filter((status) => status === 'sent').length;
    if (results.includes('skipped_budget') || results.includes('disabled')) break;
  }
  return { sent, audience };
}

/**
 * Called by notifications.notify after the in-app rows are written. Schedules the email fan-out in
 * the background so the API response never waits for it.
 */
function queueNotificationEmails(collegeId, userIds, { type, context = {}, link, refType, refId }) {
  if (!EMAIL_NOTIFICATION_TYPES.has(type) || userIds.length === 0 || !isEmailEnabled()) return null;
  if (type === 'advisory_published' && !EMAIL_ADVISORY_SEVERITIES.has(context.severity)) return null;
  return later(async () => {
    const result = await emailForNotification(collegeId, userIds, { type, context, link });
    if (type === 'advisory_published' && refType === 'advisory') {
      await advisoryRepository
        .forTenant(collegeId)
        .updateOne({ _id: refId }, { $set: { 'emailStats.sent': result.sent, 'emailStats.audience': result.audience } });
    }
    return result;
  });
}

module.exports = {
  configureEmail,
  isEmailEnabled,
  isVerificationRequired,
  getProvider,
  getBaseUrl,
  runInBackground: later,
  sendEmail,
  sendEmailLater,
  flushEmails,
  emailForNotification,
  queueNotificationEmails,
  EMAIL_NOTIFICATION_TYPES,
  FANOUT_BATCH,
  FANOUT_CONCURRENCY,
};
