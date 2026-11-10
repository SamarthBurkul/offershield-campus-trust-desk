'use strict';

const { domainToASCII } = require('node:url');

// TLDs for which a bare domain in free text (no scheme, e.g. "tcs-careers.in") is treated as a domain.
const BARE_DOMAIN_TLDS = Object.freeze([
  'com', 'in', 'co.in', 'net', 'org', 'io', 'co', 'xyz', 'info', 'online', 'site', 'top', 'live', 'work', 'careers', 'jobs',
]);

/** Lowercase, strip a leading "www." and convert IDN to ASCII punycode ("xn--..."). Null if invalid. */
function normalizeDomain(value) {
  if (typeof value !== 'string') return null;
  let domain = value.trim().toLowerCase().replace(/\.$/, '');
  domain = domainToASCII(domain);
  if (!domain || !domain.includes('.')) return null;
  domain = domain.replace(/^www\./, '');
  return /^(?=.{3,253}$)([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+(?:[a-z]{2,63}|xn--[a-z0-9-]{1,59})$/.test(domain) ? domain : null;
}

function hasAllowedBareTld(domain) {
  return BARE_DOMAIN_TLDS.some((tld) => domain.endsWith(`.${tld}`) && domain.length > tld.length + 1);
}

/**
 * http(s) URL normalised to: lowercase ASCII host without "www.", no fragment, no trailing slash.
 * @returns {{ url: string, domain: string } | null}
 */
function normalizeUrl(value) {
  let parsed;
  try {
    parsed = new URL(String(value).trim());
  } catch {
    return null;
  }
  if (!['http:', 'https:'].includes(parsed.protocol)) return null;
  const domain = normalizeDomain(parsed.hostname);
  if (!domain) return null;
  parsed.hash = '';
  parsed.username = '';
  parsed.password = '';
  parsed.hostname = domain;
  const url = parsed.toString().replace(/\/+$/, '');
  return { url, domain };
}

/** Lowercased email with a normalised domain, or null. */
function normalizeEmail(value) {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim().toLowerCase();
  const at = trimmed.lastIndexOf('@');
  if (at <= 0) return null;
  const local = trimmed.slice(0, at);
  const domain = normalizeDomain(trimmed.slice(at + 1));
  if (!domain || !/^[a-z0-9._%+-]+$/.test(local)) return null;
  return { email: `${local}@${domain}`, domain };
}

/** Indian mobile number as +91XXXXXXXXXX (first digit 6-9), or null. */
function normalizePhone(value) {
  if (typeof value !== 'string') return null;
  const compact = value.replace(/[\s-]/g, '');
  const match = /^(?:\+91|91|0)?([6-9]\d{9})$/.exec(compact);
  return match ? `+91${match[1]}` : null;
}

/** UPI ID "handle@psp": the psp has no dot (a dotted domain makes it an email). */
function normalizeUpi(value) {
  if (typeof value !== 'string') return null;
  const upi = value.trim().toLowerCase();
  return /^[a-z0-9._-]{2,256}@[a-z][a-z0-9]{1,63}$/.test(upi) ? upi : null;
}

module.exports = { BARE_DOMAIN_TLDS, normalizeDomain, hasAllowedBareTld, normalizeUrl, normalizeEmail, normalizePhone, normalizeUpi };
