'use strict';

/**
 * Indicator extraction: pure string processing only. Nothing here resolves, fetches or contacts
 * any URL, domain, phone or address.
 */
const { isFreeMailDomain } = require('./freeMailDomains');
const {
  normalizeDomain,
  hasAllowedBareTld,
  normalizeUrl,
  normalizeEmail,
  normalizePhone,
  normalizeUpi,
} = require('./normalize');

const MAX_INDICATORS = 100;

const URL_PATTERN = /\bhttps?:\/\/[^\s<>"'`]+/gi;
const EMAIL_PATTERN = /[\p{L}\p{N}._%+-]+@[\p{L}\p{N}-]+(?:\.[\p{L}\p{N}-]+)+/gu;
// Only matched after emails have been removed, so a dotted domain can never be read as a UPI psp.
const UPI_PATTERN = /(?<![\p{L}\p{N}._-])[\p{L}\p{N}._-]{2,256}@\p{L}[\p{L}\p{N}]{1,63}(?![\p{L}\p{N}@-]|\.[\p{L}\p{N}])/gu;
const BARE_DOMAIN_PATTERN = /(?<![\p{L}\p{N}@._/-])(?:[\p{L}\p{N}](?:[\p{L}\p{N}-]{0,61}[\p{L}\p{N}])?\.)+\p{L}{2,63}(?![\p{L}\p{N}-]|\.[\p{L}\p{N}])/gu;
const PHONE_PATTERN = /(?<![\d+])(?:\+91[\s-]?|91[\s-]?|0)?[6-9]\d{4}[\s-]?\d{5}(?!\d)/g;

const TRAILING_PUNCTUATION = /[.,;:!?)\]}>'"]+$/;

/** Collect matches of pattern and blank them out so later patterns cannot re-read them. */
function takeAll(text, pattern) {
  const found = [];
  const rest = text.replace(pattern, (match) => {
    found.push(match);
    return ' ';
  });
  return { found, rest };
}

function createCollector() {
  const byKey = new Map();
  return {
    add(type, value, source) {
      if (!value) return;
      const key = `${type}:${value}`;
      const existing = byKey.get(key);
      // student_entered always wins over extracted.
      if (!existing || (existing.source === 'extracted' && source === 'student_entered')) {
        byKey.set(key, { type, value, source });
      }
    },
    list: () => [...byKey.values()].slice(0, MAX_INDICATORS),
  };
}

function addEmail(collector, raw, source) {
  const email = normalizeEmail(raw);
  if (!email) return;
  collector.add('email', email.email, source);
  if (!isFreeMailDomain(email.domain)) collector.add('domain', email.domain, source);
}

function addUrl(collector, raw, source) {
  const url = normalizeUrl(String(raw).replace(TRAILING_PUNCTUATION, ''));
  if (!url) return;
  collector.add('url', url.url, source);
  collector.add('domain', url.domain, source);
}

function extractFromText(collector, text) {
  if (typeof text !== 'string' || !text) return;
  let rest = text;

  const urls = takeAll(rest, URL_PATTERN);
  urls.found.forEach((url) => addUrl(collector, url, 'extracted'));
  rest = urls.rest;

  const emails = takeAll(rest, EMAIL_PATTERN);
  emails.found.forEach((email) => addEmail(collector, email.replace(TRAILING_PUNCTUATION, ''), 'extracted'));
  rest = emails.rest;

  const upis = takeAll(rest, UPI_PATTERN);
  upis.found.forEach((upi) => collector.add('upi', normalizeUpi(upi), 'extracted'));
  rest = upis.rest;

  for (const raw of rest.match(BARE_DOMAIN_PATTERN) ?? []) {
    const domain = normalizeDomain(raw);
    if (domain && hasAllowedBareTld(domain)) collector.add('domain', domain, 'extracted');
  }

  for (const raw of rest.match(PHONE_PATTERN) ?? []) collector.add('phone', normalizePhone(raw), 'extracted');
}

/**
 * @param {{ messageText?: string, links?: string[], contacts?: { emails?: string[], phones?: string[], upiIds?: string[] } }} input
 * @returns {Array<{ type: 'email'|'domain'|'phone'|'upi'|'url', value: string, source: 'student_entered'|'extracted' }>}
 */
function extractIndicators({ messageText = '', links = [], contacts = {} } = {}) {
  const collector = createCollector();

  for (const email of contacts.emails ?? []) addEmail(collector, email, 'student_entered');
  for (const phone of contacts.phones ?? []) collector.add('phone', normalizePhone(phone), 'student_entered');
  for (const upi of contacts.upiIds ?? []) collector.add('upi', normalizeUpi(upi), 'student_entered');

  for (const link of links ?? []) addUrl(collector, link, 'extracted');
  extractFromText(collector, messageText);

  return collector.list();
}

/** Existing indicators are kept as-is; new values are appended (existing student_entered entries stay). */
function mergeIndicators(existing, additions) {
  const collector = createCollector();
  for (const item of [...existing, ...additions]) collector.add(item.type, item.value, item.source);
  return collector.list();
}

module.exports = { extractIndicators, mergeIndicators };
