'use strict';

const { domainToASCII } = require('node:url');
const { registrable, skeleton, isLookalike, isSameOrSubdomain, SIMILARITY_THRESHOLDS } = require('../src/services/registry/similarity');

describe('domain similarity', () => {
  it('1. extracts registrable domains with tldts', () => {
    expect(registrable('careers.infosys.com')).toBe('infosys.com');
    expect(registrable('abc.co.in')).toBe('abc.co.in');
    expect(registrable('jobs.abc.co.in')).toBe('abc.co.in');
    expect(registrable('WWW.Infosys.COM')).toBe('infosys.com');
    // Private suffixes count as suffixes, so a hosting subdomain is not collapsed to the host.
    expect(registrable('infosys.github.io')).toBe('infosys.github.io');
  });

  it.each([
    ['inf0sys.com', 'digit homoglyph (skeleton)'],
    ['infosys-careers.in', 'brand as hyphen token'],
    ['infosyss.com', 'edit distance 1'],
    ['rnfosys.com', '"rn" looks like "m"... and edit distance 1'],
    [domainToASCII('іnfosys.com'), 'Cyrillic і, punycode xn--nfosys-ovf.com'],
    ['careersinfosys.com', 'unseparated brand substring (5+ chars)'],
    ['infosys.co.in', 'same brand, different registrable domain'],
  ])('2. %s is a look-alike of infosys.com (%s)', (candidate) => {
    expect(isLookalike(candidate, 'infosys.com')).toBe(true);
  });

  it.each(['infosys.com', 'careers.infosys.com', 'zomato.com', 'wipro.com', 'infotech.com'])('3. %s is not a look-alike of infosys.com', (candidate) => {
    expect(isLookalike(candidate, 'infosys.com')).toBe(false);
  });

  it('3b. the same domain and its subdomains count as a match instead', () => {
    expect(isSameOrSubdomain('infosys.com', 'infosys.com')).toBe(true);
    expect(isSameOrSubdomain('careers.infosys.com', 'infosys.com')).toBe(true);
    expect(isSameOrSubdomain('notinfosys.com', 'infosys.com')).toBe(false);
  });

  it('4. short brands: no edit-distance or substring rule, but skeleton and hyphen-token rules apply', () => {
    // tcs has 3 letters (< minBrandLengthForEditDistance 5): tcss.in is NOT flagged by edit distance.
    expect(SIMILARITY_THRESHOLDS.minBrandLengthForEditDistance).toBe(5);
    expect(isLookalike('tcss.in', 'tcs.com')).toBe(false);
    expect(isLookalike('mytcsjobs.com', 'tcs.com')).toBe(false);
    // Skeleton rule still catches digit homoglyphs.
    expect(isLookalike('tc5.com', 'tcs.com')).toBe(true);
    // Hyphen-separated brand token (3+ chars) is flagged.
    expect(isLookalike('tcs-careers.in', 'tcs.com')).toBe(true);
  });

  it('skeleton maps homoglyphs, rn, vv and hyphens', () => {
    expect(skeleton('Іnf0-sys')).toBe('infosys');
    expect(skeleton('rnicrosoft')).toBe('microsoft');
    expect(skeleton('vvipro')).toBe('wipro');
    expect(skeleton('αcc3nture')).toBe('accenture');
  });
});
