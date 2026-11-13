'use strict';

/**
 * The ONLY source of email text. Each template receives a small allow-listed context and nothing
 * else: never a decision basis, the decision message, internal notes, recommendations, signals,
 * related cases or another student's data. Everything interpolated into HTML is escaped.
 */
const ALLOWED_FIELDS = Object.freeze(['name', 'code', 'link', 'caseNumber', 'claimedCompany', 'advisoryTitle', 'severity']);

// Same rule as in-app notification links: an internal path, never absolute or protocol-relative.
const INTERNAL_PATH = /^\/(?!\/)[A-Za-z0-9/_-]*$/;

const CRITICAL = 'critical';
const NORMAL = 'normal';

const escapeHtml = (value) =>
  String(value ?? '').replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]);

const clean = (value, max) => {
  const text = String(value ?? '').replace(/[\r\n\t]+/g, ' ').replace(/\s+/g, ' ').trim();
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
};

const company = (c) => (c.claimedCompany ? ` (${clean(c.claimedCompany, 60)})` : '');

/**
 * Each template: priority, why (footer reason), subject, paragraphs (plain strings) and an optional
 * call to action { label, path } (internal path, or the absolute link for reset emails).
 */
const TEMPLATES = Object.freeze({
  verify_email: {
    priority: CRITICAL,
    why: 'you created an OfferShield account with this address',
    build: (c) => ({
      subject: 'Your OfferShield verification code',
      paragraphs: [`Your verification code is ${c.code}.`, 'It expires in 10 minutes. If you did not create an account, ignore this email.'],
      highlight: c.code,
    }),
  },
  password_reset: {
    priority: CRITICAL,
    why: 'someone asked to reset the password for this address',
    build: (c) => ({
      subject: 'Reset your OfferShield password',
      paragraphs: [
        'Use the link below to choose a new password. It works once and expires in 30 minutes.',
        'If you did not ask for this, ignore this email; your password stays the same.',
      ],
      action: { label: 'Choose a new password', href: c.link },
    }),
  },
  password_reset_google: {
    priority: CRITICAL,
    why: 'someone asked to reset the password for this address',
    build: () => ({
      subject: 'Sign in to OfferShield with Google',
      paragraphs: [
        'Your OfferShield account uses Google sign-in and has no password to reset.',
        'Use "Continue with Google" on the sign-in page. If you did not ask for this, ignore this email.',
      ],
      action: { label: 'Go to sign in', path: '/login' },
    }),
  },
  password_changed: {
    priority: CRITICAL,
    why: 'the password of your OfferShield account was changed',
    build: () => ({
      subject: 'Your OfferShield password was changed',
      paragraphs: [
        'The password for your OfferShield account was just changed and other sessions were signed out.',
        'If this was not you, contact your placement cell straight away.',
      ],
      action: { label: 'Sign in', path: '/login' },
    }),
  },
  case_info_requested: {
    priority: NORMAL,
    pref: 'caseUpdates',
    why: 'you submitted a verification request',
    build: (c) => ({
      subject: `More information needed for ${c.caseNumber}`,
      paragraphs: [`Your placement cell needs more information on your request ${c.caseNumber}${company(c)}. Sign in to reply.`],
      action: { label: 'Open my request', path: '/student/requests' },
    }),
  },
  case_staff_message: {
    priority: NORMAL,
    pref: 'caseUpdates',
    why: 'you submitted a verification request',
    build: (c) => ({
      subject: `New message on ${c.caseNumber}`,
      paragraphs: [`There is a new message from your placement cell on your request ${c.caseNumber}${company(c)}. Sign in to read it.`],
      action: { label: 'Open my request', path: '/student/requests' },
    }),
  },
  case_decision: {
    priority: NORMAL,
    pref: 'caseUpdates',
    why: 'you submitted a verification request',
    build: (c) => ({
      subject: `Outcome recorded for ${c.caseNumber}`,
      paragraphs: [`Your placement cell recorded an outcome for your request ${c.caseNumber}${company(c)}. Sign in to see it.`],
      action: { label: 'Open my request', path: '/student/requests' },
    }),
  },
  case_reopened: {
    priority: NORMAL,
    pref: 'caseUpdates',
    why: 'you submitted a verification request',
    build: (c) => ({
      subject: `Request ${c.caseNumber} reopened`,
      paragraphs: [`Your request ${c.caseNumber}${company(c)} has been reopened for further review.`],
      action: { label: 'Open my request', path: '/student/requests' },
    }),
  },
  advisory_published: {
    priority: NORMAL,
    pref: 'advisories',
    why: 'your placement cell sent an advisory to your year or branch',
    build: (c) => ({
      subject: clean(`${c.severity === 'critical' ? 'Critical advisory' : 'Advisory'}: ${c.advisoryTitle}`, 120),
      paragraphs: ['Your placement cell published a new advisory. Sign in to read it and confirm you have seen it.'],
      action: { label: 'Read the advisory', path: '/advisories' },
    }),
  },
  case_submitted: {
    priority: NORMAL,
    pref: 'staffAlerts',
    why: 'you are on your college placement cell team',
    build: (c) => ({
      subject: `New verification request ${c.caseNumber}`,
      paragraphs: [`A student submitted verification request ${c.caseNumber}${company(c)}.`],
      action: { label: 'Open the case desk', path: '/staff/cases' },
    }),
  },
  student_pending: {
    priority: NORMAL,
    pref: 'staffAlerts',
    why: 'you are on your college placement cell team',
    build: () => ({
      subject: 'A student is waiting for approval',
      paragraphs: ['A student registered and is waiting for approval. Review pending students on the Students page.'],
      action: { label: 'Review students', path: '/staff/students' },
    }),
  },
});

const pick = (context) =>
  Object.fromEntries(ALLOWED_FIELDS.filter((key) => context[key] != null).map((key) => [key, clean(context[key], key === 'link' ? 600 : 160)]));

/**
 * Render { subject, text, html, priority, pref } for a type.
 * @param {string} type
 * @param {object} context only ALLOWED_FIELDS are read
 * @param {{ baseUrl: string, path?: string }} options `path`: internal deep link replacing the template's default
 */
function renderEmail(type, context = {}, { baseUrl, path }) {
  const template = TEMPLATES[type];
  if (!template) throw new Error(`Unknown email type: ${type}`);
  const base = String(baseUrl).replace(/\/+$/, '');
  const safe = pick(context);
  const built = template.build(safe);
  const subject = clean(built.subject, 140);
  const deepLink = typeof path === 'string' && INTERNAL_PATH.test(path) ? path : null;
  const actionHref = built.action ? (built.action.href ?? `${base}${deepLink ?? built.action.path}`) : null;
  const greeting = safe.name ? `Hello ${safe.name},` : 'Hello,';
  const footer = [`You received this email because ${template.why}.`, `Manage email preferences: ${base}/account`, base];

  const text = [greeting, '', ...built.paragraphs, ...(actionHref ? ['', `${built.action.label}: ${actionHref}`] : []), '', '--', ...footer].join('\n');

  const p = (inner, style = '') => `<p style="margin:0 0 14px;${style}">${inner}</p>`;
  const html = [
    '<!doctype html><html><body style="margin:0;padding:24px;background:#f8fafc;font-family:Arial,Helvetica,sans-serif;color:#0f172a;font-size:15px;line-height:1.5">',
    '<div style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:12px;padding:24px;border:1px solid #e2e8f0">',
    `<p style="margin:0 0 18px;font-weight:bold;color:#111e40">OfferShield</p>`,
    p(escapeHtml(greeting)),
    ...built.paragraphs.map((line) => p(escapeHtml(line))),
    built.highlight ? p(escapeHtml(built.highlight), 'font-size:28px;letter-spacing:6px;font-weight:bold;font-family:monospace') : '',
    actionHref
      ? p(`<a href="${escapeHtml(actionHref)}" style="display:inline-block;background:#2a4ddb;color:#ffffff;text-decoration:none;padding:10px 16px;border-radius:8px">${escapeHtml(built.action.label)}</a>`)
      : '',
    `<hr style="border:none;border-top:1px solid #e2e8f0;margin:20px 0">`,
    `<p style="margin:0;font-size:12px;color:#64748b">${escapeHtml(footer[0])}<br><a href="${escapeHtml(`${base}/account`)}" style="color:#475569">Manage email preferences</a> · <a href="${escapeHtml(base)}" style="color:#475569">${escapeHtml(base)}</a></p>`,
    '</div></body></html>',
  ].join('');

  return { subject, text, html, priority: template.priority, pref: template.pref ?? null };
}

module.exports = { renderEmail, TEMPLATES, ALLOWED_FIELDS, escapeHtml };
