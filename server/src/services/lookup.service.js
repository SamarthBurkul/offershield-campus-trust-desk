'use strict';

/**
 * "Check before you pay" lookup, for the caller's college only. Reads active fraud indicators and
 * verified recruiters; never returns case, student or staff data, and never stores the query text.
 * No network calls: everything is string matching against the college registry.
 */
const { fraudIndicatorRepository, recruiterRepository, lookupEventRepository, caseRepository } = require('../repositories');
const { normalizeDomain, normalizeEmail, normalizePhone, normalizeUpi, normalizeUrl } = require('./indicators/normalize');
const { isFreeMailDomain } = require('./indicators/freeMailDomains');
const { registrable, isLookalike } = require('./registry/similarity');
const { ownerCandidates } = require('./registry/domains');
const { idOf } = require('../utils/safeUser');

const MAX_LOOKALIKE_RECRUITERS = 1000;
const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const iso = (date) => (date ? new Date(date).toISOString() : null);

// Fixed guidance per result. Never says an offer is "safe" or "genuine".
const GUIDANCE = Object.freeze({
  confirmed_fraud:
    'Your placement cell confirmed this was used in a fraudulent offer. Do not pay or share documents. If you already paid, call 1930 or report at cybercrime.gov.in.',
  lookalike_warning:
    'This looks similar to an address your placement cell verified, but it is a different address. Treat it as suspicious and ask your placement cell.',
  verified:
    'Your placement cell verified this recruiter. Real recruiters never charge fees: make sure messages come only from the listed domains.',
  verified_expired:
    "This recruiter's verification has expired. Ask your placement cell to check it again before you respond or pay anything.",
  not_reviewed:
    'Your placement cell has not reviewed this yet. Not reviewed does not mean safe. Do not pay or share documents until your placement cell has checked it.',
});

/** Detect what the query is: email -> upi -> phone -> url -> domain -> company text. */
function detectQuery(q) {
  const text = q.trim();
  const email = text.includes('@') ? normalizeEmail(text) : null;
  if (email && email.domain.includes('.')) return { queryType: 'email', value: email.email, domain: email.domain };
  const upi = normalizeUpi(text);
  if (upi) return { queryType: 'upi', value: upi };
  const phone = normalizePhone(text);
  if (phone) return { queryType: 'phone', value: phone };
  if (/^https?:\/\//i.test(text)) {
    const url = normalizeUrl(text);
    if (url) return { queryType: 'url', value: url.url, domain: url.domain };
  }
  if (!/\s/.test(text)) {
    const domain = normalizeDomain(text.replace(/\/.*$/, ''));
    if (domain) return { queryType: 'domain', value: domain, domain };
  }
  return { queryType: 'company', value: text };
}

function fraudCandidates(query) {
  if (query.queryType === 'company') return [];
  const candidates = [{ type: query.queryType, value: query.value }];
  if (query.domain && query.queryType !== 'domain') candidates.push({ type: 'domain', value: query.domain });
  if (query.domain) {
    const base = registrable(query.domain);
    if (base && base !== query.domain) candidates.push({ type: 'domain', value: base });
  }
  return candidates;
}

function recruiterFilter(query) {
  const or = [];
  // A free-mail domain never matches a recruiter (recruiter domains and contacts cannot be free mail).
  if (query.domain && !isFreeMailDomain(query.domain)) or.push({ domains: { $in: ownerCandidates(query.domain) } });
  if (query.queryType === 'email') or.push({ contactEmails: query.value });
  if (query.queryType === 'phone') or.push({ contactPhones: query.value });
  if (query.queryType === 'company') or.push({ companyName: { $regex: escapeRegex(query.value), $options: 'i' } });
  return or.length ? { status: 'verified', $or: or } : null;
}

const isExpired = (recruiter) => Boolean(recruiter.verification?.expiresAt) && new Date(recruiter.verification.expiresAt) < new Date();

function resultStatusOf({ fraud, lookalikes, verified }) {
  if (fraud.length) return 'confirmed_fraud';
  if (lookalikes.length) return 'lookalike_warning';
  if (verified.some((recruiter) => !isExpired(recruiter))) return 'verified';
  if (verified.length) return 'verified_expired';
  return 'not_reviewed';
}

async function lookup(user, { q }) {
  const collegeId = user.collegeId;
  const query = detectQuery(q);

  const candidates = fraudCandidates(query);
  const fraud = candidates.length
    ? await fraudIndicatorRepository.forTenant(collegeId).find({ status: 'active', $or: candidates }, { lean: true, limit: 20 })
    : [];

  const filter = recruiterFilter(query);
  const verified = filter ? await recruiterRepository.forTenant(collegeId).find(filter, { lean: true, limit: 20, sort: { companyName: 1 } }) : [];

  // Look-alikes only for domain-bearing queries without a verified match.
  const lookalikes = [];
  if (query.domain && !isFreeMailDomain(query.domain) && verified.length === 0) {
    const all = await recruiterRepository
      .forTenant(collegeId)
      .find({ status: 'verified' }, { select: 'companyName domains', lean: true, limit: MAX_LOOKALIKE_RECRUITERS });
    for (const recruiter of all) {
      const domain = recruiter.domains.find((verifiedDomain) => isLookalike(query.domain, verifiedDomain));
      if (domain) lookalikes.push({ companyName: recruiter.companyName, domain });
    }
  }

  const resultStatus = resultStatusOf({ fraud, lookalikes, verified });
  await lookupEventRepository.forTenant(collegeId).create({ userId: user.id, role: user.role, queryType: query.queryType, resultStatus });

  const isStaff = user.role === 'placement_officer' || user.role === 'tpo_head';
  let caseNumbers = new Map();
  if (isStaff && fraud.length) {
    const ids = [...new Set(fraud.flatMap((item) => item.sourceCaseIds.map(String)))];
    const cases = await caseRepository.forTenant(collegeId).find({ _id: { $in: ids } }, { select: 'caseNumber', lean: true });
    caseNumbers = new Map(cases.map((item) => [String(item._id), item.caseNumber]));
  }

  return {
    resultStatus,
    queryType: query.queryType,
    fraudMatches: fraud.map((item) => ({
      type: item.type,
      value: item.value,
      confirmedAt: iso(item.lastConfirmedAt),
      // Staff-only extra: links to the source cases. Never sent to students.
      ...(isStaff ? { sourceCases: item.sourceCaseIds.map((id) => ({ id: String(id), caseNumber: caseNumbers.get(String(id)) ?? null })) } : {}),
    })),
    verifiedRecruiters: verified.map((recruiter) => ({
      id: idOf(recruiter._id),
      companyName: recruiter.companyName,
      domains: [...recruiter.domains],
      methods: [...recruiter.verification.methods],
      verifiedAt: iso(recruiter.verification.verifiedAt),
      expiresAt: iso(recruiter.verification.expiresAt),
      isExpired: isExpired(recruiter),
    })),
    lookalikeOf: lookalikes,
    guidance: GUIDANCE[resultStatus],
  };
}

module.exports = { lookup, detectQuery, GUIDANCE };
