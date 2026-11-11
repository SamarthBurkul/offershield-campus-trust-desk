'use strict';

/**
 * Look-alike domain detection (pure; no DNS or network). Compares a candidate domain with a domain
 * of a verified recruiter.
 */
const { domainToUnicode } = require('node:url');
const { getDomain, getDomainWithoutSuffix } = require('tldts');
const { normalizeDomain } = require('../indicators/normalize');

// Documented in DECISIONS.md (ADR-030). Tune here only.
const SIMILARITY_THRESHOLDS = Object.freeze({
  // Edit-distance rule: brand labels shorter than this are too short for edit distance to be meaningful.
  minBrandLengthForEditDistance: 5,
  maxEditDistance: 2,
  // Unseparated substring rule ("careersinfosys"): only for brands at least this long.
  minBrandLengthForSubstring: 5,
  // Hyphen/word-separated token rule ("infosys-careers", "tcs-jobs"): minimum brand length.
  minBrandLengthForToken: 3,
});

// Private suffixes (github.io, vercel.app …) are treated as public suffixes, so a free hosting
// subdomain is its own registrable domain rather than collapsing to the hosting provider.
const TLD_OPTIONS = { allowPrivateDomains: true };

const HOMOGLYPHS = new Map(
  Object.entries({
    // Cyrillic
    а: 'a', е: 'e', о: 'o', р: 'p', с: 'c', х: 'x', у: 'y', і: 'i', ј: 'j', ѕ: 's',
    // Greek
    ο: 'o', α: 'a',
    // Digits
    0: 'o', 1: 'l', 3: 'e', 5: 's',
  }),
);

/** ASCII (punycode) registrable domain, e.g. careers.infosys.com -> infosys.com. Null if invalid. */
function registrable(domain) {
  const ascii = normalizeDomain(String(domain ?? ''));
  if (!ascii) return null;
  return getDomain(ascii, TLD_OPTIONS) ?? ascii;
}

/** The brand label of a registrable domain in Unicode (punycode decoded), e.g. "infosys". */
function mainLabel(registrableDomain) {
  const label = getDomainWithoutSuffix(registrableDomain, TLD_OPTIONS) ?? registrableDomain.split('.')[0];
  return domainToUnicode(label) || label;
}

/** Canonical form for visual comparison: homoglyphs -> Latin, rn -> m, vv -> w, no hyphens. */
function skeleton(label) {
  const mapped = [...String(label).toLowerCase()].map((ch) => HOMOGLYPHS.get(ch) ?? ch).join('');
  return mapped.replace(/rn/g, 'm').replace(/vv/g, 'w').replace(/-/g, '');
}

function levenshtein(a, b) {
  if (a === b) return 0;
  let previous = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i += 1) {
    const current = [i];
    for (let j = 1; j <= b.length; j += 1) {
      current[j] = Math.min(previous[j] + 1, current[j - 1] + 1, previous[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    previous = current;
  }
  return previous[b.length];
}

/** True when candidate is the verified domain itself or one of its subdomains (a match, not a look-alike). */
function isSameOrSubdomain(candidate, verifiedDomain) {
  const c = normalizeDomain(String(candidate ?? ''));
  const v = normalizeDomain(String(verifiedDomain ?? ''));
  return Boolean(c && v && (c === v || c.endsWith(`.${v}`)));
}

/**
 * True when `candidate` imitates `verifiedDomain`: their registrable domains differ AND
 * (equal skeletons, OR edit distance <= 2 for brands of 5+ chars, OR the brand appears as a
 * hyphen/word token (3+ chars) or unseparated substring (5+ chars) of the candidate's label).
 */
function isLookalike(candidate, verifiedDomain) {
  const c = registrable(candidate);
  const v = registrable(verifiedDomain);
  if (!c || !v || c === v) return false;

  const candidateLabel = mainLabel(c);
  const brandLabel = mainLabel(v);
  const candidateSkeleton = skeleton(candidateLabel);
  const brandSkeleton = skeleton(brandLabel);
  const t = SIMILARITY_THRESHOLDS;

  if (candidateSkeleton === brandSkeleton) return true;
  if (brandLabel.length >= t.minBrandLengthForEditDistance && levenshtein(candidateLabel, brandLabel) <= t.maxEditDistance) return true;

  if (brandSkeleton.length >= t.minBrandLengthForToken) {
    const tokens = [...candidateLabel.toLowerCase().split(/[^\p{L}\p{N}]+/u)].map(skeleton);
    if (tokens.length > 1 && tokens.includes(brandSkeleton)) return true;
  }
  if (brandSkeleton.length >= t.minBrandLengthForSubstring && candidateSkeleton.includes(brandSkeleton)) return true;
  return false;
}

module.exports = { SIMILARITY_THRESHOLDS, registrable, mainLabel, skeleton, levenshtein, isSameOrSubdomain, isLookalike };
