'use strict';

const mongoose = require('mongoose');
const { useTestDatabase } = require('./helpers/db');
const { createTestApp } = require('./helpers/auth');
const { setupTwoColleges, createCaseAs, validCaseBody } = require('./helpers/cases');
const { Case } = require('../src/models/Case');
const { LookupEvent } = require('../src/models/LookupEvent');
const { FraudIndicator } = require('../src/models/FraudIndicator');
const { Recruiter } = require('../src/models/Recruiter');
const { Advisory } = require('../src/models/Advisory');
const { Acknowledgement } = require('../src/models/Acknowledgement');
const { median } = require('../src/services/stats.service');

useTestDatabase();

let app;
let ctx;
beforeAll(() => {
  app = createTestApp();
});
beforeEach(async () => {
  jest.spyOn(console, 'warn').mockImplementation(() => {});
  ctx = await setupTwoColleges(app);
});

const HOUR = 3_600_000;
const DAY = 24 * HOUR;
const oid = (id) => new mongoose.Types.ObjectId(String(id));
const MESSAGES = [
  'Selected for the analyst internship, pay the onboarding amount to confirm today please.',
  'Interview invitation for the operations role at our Pune branch office next Monday morning.',
  'Your campus drive registration link is attached, kindly fill the form before Friday evening.',
  'Old message about a trainee programme that arrived many months ago from an unknown sender.',
  'Beta college message about a fee that must not be counted in alpha statistics at all.',
];
const body = (i, overrides) => validCaseBody({ messageText: MESSAGES[i], links: [], contacts: { emails: [], phones: [], upiIds: [] }, ...overrides });

async function fixture() {
  const studentA = await ctx.as('student@demo-alpha.test.edu');
  const studentB = await ctx.as('student@demo-beta.test.edu');
  const c1 = await createCaseAs(studentA, body(0, { channel: 'whatsapp', moneyRequested: { requested: true, amount: 999, purpose: 'registration' }, paidAlready: true }));
  const c2 = await createCaseAs(studentA, body(1, { channel: 'email', moneyRequested: { requested: true } }));
  const c3 = await createCaseAs(studentA, body(2, { channel: 'whatsapp' }));
  const c4 = await createCaseAs(studentA, body(3, { channel: 'telegram' }));
  const b1 = await createCaseAs(studentB, body(4, { channel: 'whatsapp', moneyRequested: { requested: true, amount: 5000 }, paidAlready: true }));

  const now = Date.now();
  const set = (id, fields) => Case.collection.updateOne({ _id: oid(id) }, { $set: fields });
  const decision = (type, created, hours) => ({ type, basis: 'x'.repeat(40), checks: [], studentMessage: 'Outcome message.', confirmedIndicators: [], verifiedDomains: [], decidedBy: ctx.alpha.head._id, decidedAt: new Date(created + hours * HOUR) });
  const t1 = now - 2 * DAY;
  const t2 = now - 3 * DAY;
  await set(c1.id, { createdAt: new Date(t1), status: 'confirmed_fraud', decision: decision('confirmed_fraud', t1, 10), linkedCaseIds: [oid(c2.id)] });
  await set(c2.id, { createdAt: new Date(t2), status: 'inconclusive', decision: decision('inconclusive', t2, 21), linkedCaseIds: [oid(c1.id)] });
  await set(c3.id, { lastActivityAt: new Date(now - 10 * DAY), assigneeId: null, linkedCaseIds: [] });
  await set(c4.id, { createdAt: new Date(now - 200 * DAY), status: 'dismissed', linkedCaseIds: [] });
  await set(b1.id, { status: 'confirmed_fraud', decision: decision('confirmed_fraud', now, 1), linkedCaseIds: [oid(b1.id)] });

  const A = ctx.alpha.college._id;
  const B = ctx.beta.college._id;
  const u = ctx.alpha.head._id;
  await LookupEvent.create([
    { collegeId: A, userId: u, role: 'student', queryType: 'upi', resultStatus: 'confirmed_fraud' },
    { collegeId: A, userId: u, role: 'student', queryType: 'upi', resultStatus: 'confirmed_fraud' },
    { collegeId: A, userId: u, role: 'student', queryType: 'domain', resultStatus: 'not_reviewed' },
    { collegeId: B, userId: u, role: 'student', queryType: 'domain', resultStatus: 'verified' },
  ]);
  const fi = (collegeId, value, status) => ({ collegeId, type: 'upi', value, status, firstConfirmedAt: new Date(), lastConfirmedAt: new Date(), createdBy: u });
  await FraudIndicator.create([fi(A, 'a1@ybl', 'active'), fi(A, 'a2@ybl', 'active'), fi(A, 'a3@ybl', 'revoked'), fi(B, 'b1@ybl', 'active')]);
  const rec = (collegeId, companyName, status, expiresInDays) => ({
    collegeId,
    companyName,
    domains: [`${companyName.toLowerCase()}.com`],
    status,
    verification: { methods: ['other'], evidenceNote: 'Evidence note long enough here.', validForDays: 365, expiresAt: expiresInDays == null ? null : new Date(now + expiresInDays * DAY) },
    createdBy: u,
  });
  await Recruiter.create([rec(A, 'Valid', 'verified', 30), rec(A, 'Expired', 'verified', -1), rec(A, 'Pending', 'pending_approval', null), rec(B, 'Bvalid', 'verified', 30)]);
  const adv = (collegeId, status, audience) => ({ collegeId, title: 'Advisory title here', body: 'An advisory body that is long enough.', status, createdBy: u, audienceCountAtPublish: audience, publishedAt: status === 'published' ? new Date() : null });
  const [pubA] = await Advisory.create([adv(A, 'published', 4), adv(A, 'draft', null), adv(B, 'published', 10)]);
  await Acknowledgement.create({ collegeId: A, advisoryId: pubA._id, userId: ctx.alpha.student._id });
}

describe('GET /staff/stats', () => {
  it('17. computes every college A statistic exactly and ignores college B', async () => {
    await fixture();
    const officer = await ctx.as('officer@demo-alpha.test.edu');
    const res = await officer.get('/api/v1/staff/stats');
    expect(res.status).toBe(200);
    const { stats } = res.body;

    expect(stats.cases.byStatus).toEqual({ submitted: 1, under_review: 0, awaiting_student: 0, confirmed_fraud: 1, verified_genuine: 0, inconclusive: 1, dismissed: 0 });
    expect(stats.cases.byChannel).toMatchObject({ whatsapp: 2, email: 1, telegram: 0 });
    expect(stats.cases.createdPerWeek).toHaveLength(8);
    expect(stats.cases.createdPerWeek.reduce((sum, week) => sum + week.count, 0)).toBe(3);
    expect(stats.cases.createdPerWeek[0].week).toMatch(/^\d{4}-W\d{2}$/);
    expect(stats.cases).toMatchObject({ openCount: 1, staleOpenCount: 1, unassignedOpenCount: 1 });

    expect(stats.decisions).toEqual({ byType: { confirmed_fraud: 1, verified_genuine: 0, inconclusive: 1, dismissed: 0 }, medianHoursToDecision: 15.5 });
    expect(stats.money).toEqual({ casesWithFeeRequested: 2, totalAmountRequested: 999, studentsReportedPaid: 1 });
    expect(stats.registry).toEqual({ activeFraudIndicators: 2, verifiedRecruiters: 1, expiredRecruiters: 1, pendingRecruiters: 1 });
    expect(stats.lookups).toEqual({ confirmed_fraud: 2, lookalike_warning: 0, verified: 0, verified_expired: 0, not_reviewed: 1 });
    expect(stats.advisories).toEqual({ publishedCount: 1, overallAckRate: 0.25 });
    expect(stats.relatedCaseLinks).toBe(2);

    // A custom range that includes the 200-day-old case.
    const wide = await officer.get(`/api/v1/staff/stats?from=${new Date(Date.now() - 365 * DAY).toISOString()}`);
    expect(wide.body.stats.cases.byStatus.dismissed).toBe(1);
    expect(median([1, 3, 2])).toBe(2);
    expect(median([])).toBeNull();
  });

  it('18. students and the super admin get 403; officers 200', async () => {
    const { createSuperAdmin } = require('./helpers/factories');
    await createSuperAdmin();
    expect((await (await ctx.as('student@demo-alpha.test.edu')).get('/api/v1/staff/stats')).status).toBe(403);
    expect((await (await ctx.as('root@platform.test')).get('/api/v1/staff/stats')).status).toBe(403);
    expect((await (await ctx.as('officer@demo-alpha.test.edu')).get('/api/v1/staff/stats')).status).toBe(200);
    expect((await (await ctx.as('head@demo-alpha.test.edu')).get('/api/v1/staff/stats?from=2026-12-01&to=2026-01-01')).status).toBe(400);
  });
});
