'use strict';

const { computeSignals, topSignal } = require('../src/services/signals/compute');
const { findFeePhrase } = require('../src/services/signals/feeLanguage');
const { useTestDatabase } = require('./helpers/db');
const { createTestApp } = require('./helpers/auth');
const { setupTwoColleges } = require('./helpers/cases');
const { scamCaseBody } = require('./helpers/registry');
const { Case } = require('../src/models/Case');

const recruiter = { _id: 'r1', companyName: 'Infosys', domains: ['infosys.com'] };

/** A neutral case: no signal fires. */
const base = (overrides = {}) => ({
  claimedCompany: 'Acme Analytics',
  channel: 'email',
  messageText: 'Please find the interview schedule attached. Regards, Acme HR.',
  indicators: [{ type: 'domain', value: 'acme-analytics.com', source: 'extracted' }],
  moneyRequested: { requested: false, amount: null, purpose: null },
  paidAlready: false,
  documentsShared: false,
  ...overrides,
});

const codes = (caseDoc, registry = {}) => computeSignals(caseDoc, registry).map((signal) => signal.code);

describe('6. each signal code fires on its fixture and not on its negative', () => {
  it('the neutral case has no signals', () => {
    expect(codes(base(), { verifiedRecruiters: [recruiter], activeIndicators: [] })).toEqual([]);
  });

  it('MATCHES_CONFIRMED_INDICATOR', () => {
    const upi = { type: 'upi', value: 'fee.desk@ybl' };
    const caseDoc = base({ indicators: [...base().indicators, { ...upi, source: 'extracted' }] });
    const signals = computeSignals(caseDoc, { activeIndicators: [upi] });
    expect(signals[0]).toMatchObject({ code: 'MATCHES_CONFIRMED_INDICATOR', severity: 'high', detail: { matches: [upi] } });
    expect(codes(caseDoc, { activeIndicators: [{ type: 'upi', value: 'other@ybl' }] })).not.toContain('MATCHES_CONFIRMED_INDICATOR');
  });

  it('FEE_REQUESTED (form or message text)', () => {
    expect(codes(base({ moneyRequested: { requested: true, amount: 499, purpose: 'registration' } }))).toContain('FEE_REQUESTED');
    expect(codes(base({ messageText: 'A refundable deposit of 2000 confirms your joining.' }))).toContain('FEE_REQUESTED');
    expect(codes(base({ messageText: 'No payment of any kind is needed.' }))).not.toContain('FEE_REQUESTED');
  });

  it('ALREADY_PAID', () => {
    expect(codes(base({ paidAlready: true }))).toContain('ALREADY_PAID');
    expect(codes(base())).not.toContain('ALREADY_PAID');
  });

  it('LOOKALIKE_DOMAIN', () => {
    const caseDoc = base({ indicators: [{ type: 'domain', value: 'infosys-careers.in', source: 'extracted' }] });
    const signals = computeSignals(caseDoc, { verifiedRecruiters: [recruiter] });
    expect(signals.find((s) => s.code === 'LOOKALIKE_DOMAIN').detail.lookalikes[0]).toMatchObject({ domain: 'infosys-careers.in', lookalikeOf: 'infosys.com' });
    expect(codes(base({ indicators: [{ type: 'domain', value: 'careers.infosys.com', source: 'extracted' }] }), { verifiedRecruiters: [recruiter] })).not.toContain(
      'LOOKALIKE_DOMAIN',
    );
  });

  it('CLAIMED_COMPANY_DOMAIN_MISMATCH', () => {
    const claimsInfosys = base({ claimedCompany: ' INFOSYS ', indicators: [{ type: 'domain', value: 'random-jobs.xyz', source: 'extracted' }] });
    expect(codes(claimsInfosys, { verifiedRecruiters: [recruiter] })).toContain('CLAIMED_COMPANY_DOMAIN_MISMATCH');
    const usesRealDomain = base({ claimedCompany: 'Infosys', indicators: [{ type: 'email', value: 'campus@careers.infosys.com', source: 'extracted' }] });
    expect(codes(usesRealDomain, { verifiedRecruiters: [recruiter] })).not.toContain('CLAIMED_COMPANY_DOMAIN_MISMATCH');
  });

  it('FREE_MAIL_SENDER', () => {
    expect(codes(base({ indicators: [{ type: 'email', value: 'acme.hr@gmail.com', source: 'extracted' }] }))).toContain('FREE_MAIL_SENDER');
    expect(codes(base({ indicators: [{ type: 'email', value: 'hr@acme-analytics.com', source: 'extracted' }] }))).not.toContain('FREE_MAIL_SENDER');
  });

  it('OFF_PLATFORM_ONLY', () => {
    expect(codes(base({ channel: 'telegram', indicators: [] }))).toContain('OFF_PLATFORM_ONLY');
    expect(codes(base({ channel: 'telegram' }))).not.toContain('OFF_PLATFORM_ONLY');
    expect(codes(base({ channel: 'email', indicators: [] }))).not.toContain('OFF_PLATFORM_ONLY');
  });

  it('URGENCY_LANGUAGE', () => {
    expect(codes(base({ messageText: 'Reply within 24 hours, limited seats!' }))).toContain('URGENCY_LANGUAGE');
    expect(codes(base({ messageText: 'Reply whenever convenient.' }))).not.toContain('URGENCY_LANGUAGE');
  });

  it('DOCUMENTS_SHARED', () => {
    expect(codes(base({ documentsShared: true }))).toContain('DOCUMENTS_SHARED');
    expect(codes(base())).not.toContain('DOCUMENTS_SHARED');
  });

  it('orders by severity and topSignal returns the most severe code', () => {
    const signals = computeSignals(base({ documentsShared: true, channel: 'whatsapp', indicators: [], paidAlready: true }));
    expect(signals.map((s) => s.severity)).toEqual(['high', 'warning', 'info']);
    expect(topSignal(signals)).toBe('ALREADY_PAID');
    expect(topSignal([])).toBeNull();
  });
});

describe('7. Hinglish fee phrases', () => {
  it.each(['Joining ke liye 500 fees lagegi', 'Pehle 999 pay karna hoga', 'Kit charges 1200 hain', 'Pay ₹499 now', 'pay rs 300 today'])('detects "%s"', (text) => {
    expect(findFeePhrase(text)).not.toBeNull();
  });

  it('does not match inside other words', () => {
    expect(findFeePhrase('We are hiring for compliance training roles.')).toBeNull();
  });
});

describe('8. signals are staff-only', () => {
  useTestDatabase();
  let ctx;
  beforeEach(async () => {
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    ctx = await setupTwoColleges(createTestApp());
  });

  it('are stored on the case but never appear in the student view', async () => {
    const student = await ctx.as('student@demo-alpha.test.edu');
    const created = await student.post('/api/v1/cases').send(scamCaseBody());
    const stored = await Case.findById(created.body.case.id).lean();
    expect(stored.signals.map((s) => s.code)).toEqual(expect.arrayContaining(['FEE_REQUESTED', 'FREE_MAIL_SENDER', 'URGENCY_LANGUAGE']));
    expect(stored.signalsComputedAt).toBeInstanceOf(Date);
    expect(stored.priority).toBe('high'); // from moneyRequested, not from signals

    const view = await student.get(`/api/v1/cases/${created.body.case.id}`);
    for (const forbidden of ['signals', 'FEE_REQUESTED', 'FREE_MAIL_SENDER', 'textHash', 'related', 'linkedCaseIds', stored.textHash]) {
      expect(view.text).not.toContain(forbidden);
    }
    expect(JSON.stringify(created.body)).not.toContain('signals');
  });
});
