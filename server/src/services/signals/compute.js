'use strict';

/**
 * Staff-only warning signals (pure). Signals are hints for triage: they never change a case's
 * status or priority, never block a request and are never shown to students.
 */
const { isFreeMailDomain } = require('../indicators/freeMailDomains');
const { isLookalike, isSameOrSubdomain } = require('../registry/similarity');
const { findFeePhrase, findUrgencyPhrase } = require('./feeLanguage');

const SEVERITY_RANK = Object.freeze({ high: 3, warning: 2, info: 1 });
const OFF_PLATFORM_CHANNELS = new Set(['whatsapp', 'telegram', 'instagram']);

const key = (type, value) => `${type}:${value}`;
const emailDomain = (email) => email.slice(email.lastIndexOf('@') + 1);
const sameName = (a, b) => String(a ?? '').trim().toLowerCase() === String(b ?? '').trim().toLowerCase();

/**
 * @param {object} caseDoc case (lean or document) with indicators, messageText, money fields, channel
 * @param {{ activeIndicators: Array<{type,value}>, verifiedRecruiters: Array<{_id, companyName, domains}> }} registry
 * @returns {Array<{ code, severity, message, detail }>}
 */
function computeSignals(caseDoc, { activeIndicators = [], verifiedRecruiters = [] } = {}) {
  const signals = [];
  const add = (code, severity, message, detail = {}) => signals.push({ code, severity, message, detail });
  const indicators = caseDoc.indicators ?? [];
  const domains = indicators.filter((item) => item.type === 'domain').map((item) => item.value);
  const emails = indicators.filter((item) => item.type === 'email').map((item) => item.value);
  const text = caseDoc.messageText ?? '';

  const confirmed = new Set(activeIndicators.map((item) => key(item.type, item.value)));
  const matches = indicators.filter((item) => confirmed.has(key(item.type, item.value))).map(({ type, value }) => ({ type, value }));
  if (matches.length) {
    add('MATCHES_CONFIRMED_INDICATOR', 'high', `Matches ${matches.length} confirmed fraud indicator(s) in your college registry`, { matches });
  }

  const feePhrase = findFeePhrase(text);
  if (caseDoc.moneyRequested?.requested || feePhrase) {
    add('FEE_REQUESTED', 'high', 'A fee or deposit was requested', {
      source: caseDoc.moneyRequested?.requested ? 'form' : 'message',
      phrase: feePhrase,
      amount: caseDoc.moneyRequested?.amount ?? null,
    });
  }

  if (caseDoc.paidAlready) add('ALREADY_PAID', 'high', 'The student says they have already paid');

  const lookalikes = [];
  for (const domain of domains) {
    for (const recruiter of verifiedRecruiters) {
      const target = recruiter.domains.find((verified) => isLookalike(domain, verified));
      if (target) lookalikes.push({ domain, lookalikeOf: target, companyName: recruiter.companyName });
    }
  }
  if (lookalikes.length) add('LOOKALIKE_DOMAIN', 'high', 'A domain imitates a verified recruiter domain', { lookalikes });

  const claimed = verifiedRecruiters.filter((recruiter) => sameName(recruiter.companyName, caseDoc.claimedCompany));
  const ownsCaseDomain = (recruiter) =>
    [...domains, ...emails.map(emailDomain)].some((domain) => recruiter.domains.some((verified) => isSameOrSubdomain(domain, verified)));
  const mismatched = claimed.filter((recruiter) => !ownsCaseDomain(recruiter));
  if (mismatched.length) {
    add('CLAIMED_COMPANY_DOMAIN_MISMATCH', 'warning', 'Claims to be a verified recruiter but uses none of its domains', {
      companyName: mismatched[0].companyName,
      verifiedDomains: mismatched[0].domains,
    });
  }

  const freeMail = emails.filter((email) => isFreeMailDomain(emailDomain(email)));
  if (freeMail.length && caseDoc.claimedCompany) {
    add('FREE_MAIL_SENDER', 'warning', 'Claims a company but writes from a free email provider', { emails: freeMail });
  }

  if (OFF_PLATFORM_CHANNELS.has(caseDoc.channel) && domains.length === 0) {
    add('OFF_PLATFORM_ONLY', 'info', 'Contact is only through a messaging app, with no company domain', { channel: caseDoc.channel });
  }

  const urgency = findUrgencyPhrase(text);
  if (urgency) add('URGENCY_LANGUAGE', 'info', 'The message pressures the student to act quickly', { phrase: urgency });

  if (caseDoc.documentsShared) add('DOCUMENTS_SHARED', 'warning', 'The student has already shared personal documents');

  return signals.sort((a, b) => SEVERITY_RANK[b.severity] - SEVERITY_RANK[a.severity]);
}

/** Code of the most severe signal, or null. */
function topSignal(signals = []) {
  const [top] = [...signals].sort((a, b) => SEVERITY_RANK[b.severity] - SEVERITY_RANK[a.severity]);
  return top ? top.code : null;
}

module.exports = { computeSignals, topSignal, SEVERITY_RANK };
