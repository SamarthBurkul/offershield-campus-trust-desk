'use strict';

const { normalizeDomain, normalizeEmail, normalizeUrl } = require('../indicators/normalize');
const { registrable } = require('./similarity');

/**
 * A host and each parent down to its registrable domain:
 * "a.careers.infosys.com" -> ["a.careers.infosys.com", "careers.infosys.com", "infosys.com"].
 * A recruiter domain "owns" a host when it is one of these (same domain or a parent).
 */
function ownerCandidates(domain) {
  const host = normalizeDomain(String(domain ?? ''));
  if (!host) return [];
  const base = registrable(host) ?? host;
  const labels = host.split('.');
  const result = [];
  for (let i = 0; i < labels.length; i += 1) {
    const candidate = labels.slice(i).join('.');
    result.push(candidate);
    if (candidate === base) break;
  }
  return result;
}

/** The domain an indicator points at (domain itself, email domain or URL host), or null (phone, UPI). */
function indicatorDomain({ type, value }) {
  if (type === 'domain') return normalizeDomain(value);
  if (type === 'email') return normalizeEmail(value)?.domain ?? null;
  if (type === 'url') return normalizeUrl(value)?.domain ?? null;
  return null;
}

module.exports = { ownerCandidates, indicatorDomain };
