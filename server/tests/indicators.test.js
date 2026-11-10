'use strict';

const { extractIndicators, mergeIndicators } = require('../src/services/indicators/extract');
const { normalizeUrl, normalizePhone } = require('../src/services/indicators/normalize');

const values = (indicators, type) => indicators.filter((item) => item.type === type).map((item) => item.value);

describe('indicator extraction', () => {
  it('17. lowercases emails and adds non-free-mail domains', () => {
    const indicators = extractIndicators({ messageText: 'Write to HR.Team@TCS-Careers.IN or recruiter.x@Gmail.com today' });

    expect(values(indicators, 'email')).toEqual(['hr.team@tcs-careers.in', 'recruiter.x@gmail.com']);
    expect(values(indicators, 'domain')).toEqual(['tcs-careers.in']);
  });

  it('18. normalises URLs (lowercase host, no fragment or trailing slash) and adds the host without www.', () => {
    const indicators = extractIndicators({
      messageText: 'Apply now: https://WWW.Fast-Jobs.XYZ/Apply/Now/#form, then http://portal.example.org/.',
      links: ['https://Careers.Example.com/Path/?ref=wa#x'],
    });

    expect(values(indicators, 'url')).toEqual([
      'https://careers.example.com/Path/?ref=wa',
      'https://fast-jobs.xyz/Apply/Now',
      'http://portal.example.org',
    ]);
    expect(values(indicators, 'domain')).toEqual(['careers.example.com', 'fast-jobs.xyz', 'portal.example.org']);
    expect(normalizeUrl('javascript:alert(1)')).toBeNull();
    expect(normalizeUrl('ftp://files.example.com')).toBeNull();
  });

  it('19. converts an IDN homoglyph domain to xn-- punycode', () => {
    // "tсs-careers.in" with a Cyrillic "с" (U+0441).
    const indicators = extractIndicators({ messageText: 'Visit tсs-careers.in and https://аpple-jobs.com/x' });

    const domains = values(indicators, 'domain');
    expect(domains).toHaveLength(2);
    for (const domain of domains) expect(domain).toMatch(/^xn--/);
    expect(domains).not.toContain('tcs-careers.in');
    expect(values(indicators, 'url')[0]).toMatch(/^https:\/\/xn--/);
  });

  it('20. extracts bare domains only for allow-listed TLDs', () => {
    const indicators = extractIndicators({
      messageText:
        'Check tcs-careers.in, offers.co.in and quick-hire.careers. Ignore e.g. this, version 2.0, report.pdf, notes.docx and evil.ru.',
    });

    expect(values(indicators, 'domain')).toEqual(['tcs-careers.in', 'offers.co.in', 'quick-hire.careers']);
  });

  it('never reads email local parts as domains', () => {
    const indicators = extractIndicators({ messageText: 'Mail first.last.com@gmail.com now' });

    expect(values(indicators, 'domain')).toEqual([]);
    expect(values(indicators, 'email')).toEqual(['first.last.com@gmail.com']);
  });

  it('21. normalises Indian mobile formats to +91XXXXXXXXXX and ignores others', () => {
    const indicators = extractIndicators({
      messageText: 'Call +91 98765 43210 or 09876543210, 91-9876543210, 9876543210, or 8123456789. Not 12345 or 5123456789.',
    });

    expect(values(indicators, 'phone')).toEqual(['+919876543210', '+918123456789']);
    for (const raw of ['+91 98765 43210', '09876543210', '91-9876543210', '9876543210']) {
      expect(normalizePhone(raw)).toBe('+919876543210');
    }
    expect(normalizePhone('12345')).toBeNull();
    expect(normalizePhone('5123456789')).toBeNull();
  });

  it('22. treats rahul@okaxis as UPI and rahul@okaxis.com as an email', () => {
    const indicators = extractIndicators({ messageText: 'Pay Rahul@OkAxis now. Receipt goes to rahul@okaxis.com. Or pay 9999@ybl.' });

    expect(values(indicators, 'upi')).toEqual(['rahul@okaxis', '9999@ybl']);
    expect(values(indicators, 'email')).toEqual(['rahul@okaxis.com']);
  });

  it('23. removes duplicates and student_entered wins over extracted', () => {
    const indicators = extractIndicators({
      messageText: 'Pay pay.me@ybl, pay.me@ybl again, call 9876543210 and visit https://x-jobs.in/',
      links: ['https://x-jobs.in'],
      contacts: { emails: [], phones: ['+91 98765-43210'], upiIds: ['PAY.ME@ybl'] },
    });

    expect(indicators).toEqual(
      expect.arrayContaining([
        { type: 'upi', value: 'pay.me@ybl', source: 'student_entered' },
        { type: 'phone', value: '+919876543210', source: 'student_entered' },
        { type: 'url', value: 'https://x-jobs.in', source: 'extracted' },
        { type: 'domain', value: 'x-jobs.in', source: 'extracted' },
      ]),
    );
    expect(indicators).toHaveLength(4);
  });

  it('mergeIndicators keeps existing entries and appends new ones', () => {
    const existing = [{ type: 'upi', value: 'asha@ybl', source: 'student_entered' }];
    const merged = mergeIndicators(existing, extractIndicators({ messageText: 'now pay asha@ybl or bharat@paytm' }));

    expect(merged).toEqual([
      { type: 'upi', value: 'asha@ybl', source: 'student_entered' },
      { type: 'upi', value: 'bharat@paytm', source: 'extracted' },
    ]);
  });
});
