'use strict';

const { useTestDatabase } = require('./helpers/db');
const { createTestApp } = require('./helpers/auth');
const { setupDesk, createCaseAs } = require('./helpers/staffDesk');
const { createSuperAdmin } = require('./helpers/factories');
const { scamCaseBody, plainCaseBody, createRecruiter, confirmFraud } = require('./helpers/registry');
const { Case } = require('../src/models/Case');
const { FraudIndicator } = require('../src/models/FraudIndicator');
const { Recruiter } = require('../src/models/Recruiter');

useTestDatabase();

let app;
let ctx;
beforeAll(() => {
  app = createTestApp();
});
beforeEach(async () => {
  jest.spyOn(console, 'warn').mockImplementation(() => {});
  ctx = await setupDesk(app);
});

const UPI = { type: 'upi', value: 'infosys.onboard@ybl' };

/** College B: a confirmed fraud UPI and a verified recruiter. */
async function seedCollegeB() {
  const studentB = await ctx.as('student@demo-beta.test.edu');
  const scamB = await createCaseAs(studentB, scamCaseBody());
  await confirmFraud(ctx.headB, scamB.id, [UPI]);
  const recruiterB = await createRecruiter(ctx.headB, { companyName: 'Beta Verified', domains: ['betaverified.com'], contactEmails: [], contactPhones: [] });
  const indicatorB = await FraudIndicator.findOne({ collegeId: ctx.beta.college._id }).lean();
  return { studentB, scamB, recruiterB, indicatorB };
}

describe('registry, lookup and linking isolation', () => {
  it("34. college B's indicators and recruiters never appear for college A", async () => {
    await seedCollegeB();

    const upi = await ctx.studentA.get(`/api/v1/lookup?q=${UPI.value}`);
    expect(upi.body).toMatchObject({ resultStatus: 'not_reviewed', fraudMatches: [] });
    const domain = await ctx.studentA.get('/api/v1/lookup?q=betaverified.com');
    expect(domain.body).toMatchObject({ resultStatus: 'not_reviewed', verifiedRecruiters: [] });
    expect((await ctx.studentA.get('/api/v1/lookup?q=Beta%20Verified')).body.verifiedRecruiters).toEqual([]);

    expect((await ctx.headA.get('/api/v1/staff/registry/indicators')).body.indicators).toEqual([]);
    expect((await ctx.headA.get(`/api/v1/staff/registry/indicators?q=${UPI.value}`)).body.total).toBe(0);
    expect((await ctx.headA.get('/api/v1/staff/registry/recruiters')).body.recruiters).toEqual([]);

    // Identical values in A stay independent.
    const caseA = await createCaseAs(ctx.studentA, plainCaseBody('a', { contacts: { emails: [], phones: [], upiIds: [UPI.value] } }));
    expect((await Case.findById(caseA.id).lean()).signals.map((s) => s.code)).not.toContain('MATCHES_CONFIRMED_INDICATOR');
  });

  it('35. cross-college ids on every registry and link route return 404', async () => {
    const { scamB, recruiterB, indicatorB } = await seedCollegeB();
    const routes = [
      ['patch', `/api/v1/staff/registry/recruiters/${recruiterB.id}`, { companyName: 'Hijack' }],
      ['post', `/api/v1/staff/registry/recruiters/${recruiterB.id}/approve`, {}],
      ['post', `/api/v1/staff/registry/recruiters/${recruiterB.id}/renew`, { methods: ['other'], evidenceNote: 'Cross-college renew attempt here.' }],
      ['post', `/api/v1/staff/registry/recruiters/${recruiterB.id}/suspend`, { reason: 'Cross-college suspend attempt.' }],
      ['post', `/api/v1/staff/registry/indicators/${indicatorB._id}/revoke`, { reason: 'Cross-college revoke attempt.' }],
      ['post', `/api/v1/staff/cases/${scamB.id}/links`, { caseId: ctx.caseA.id }],
      ['post', `/api/v1/staff/cases/${ctx.caseA.id}/links`, { caseId: scamB.id }],
      ['delete', `/api/v1/staff/cases/${ctx.caseA.id}/links/${scamB.id}`, undefined],
      ['post', `/api/v1/staff/cases/${scamB.id}/signals/recompute`, {}],
    ];
    for (const [method, path, body] of routes) {
      let req = ctx.headA[method](path);
      if (body) req = req.send(body);
      const res = await req;
      expect([path, res.status]).toEqual([path, 404]);
    }
    expect(await Recruiter.findById(recruiterB.id).lean()).toMatchObject({ companyName: 'Beta Verified', status: 'verified' });
    expect(await FraudIndicator.findById(indicatorB._id).lean()).toMatchObject({ status: 'active' });
    expect((await Case.findById(ctx.caseA.id).lean()).linkedCaseIds).toEqual([]);
  });

  it("36. the same UPI confirmed in B neither links to nor signals on A's cases", async () => {
    const { scamB } = await seedCollegeB();
    const caseA = await createCaseAs(ctx.studentA, scamCaseBody());

    const stored = await Case.findById(caseA.id).lean();
    expect(stored.related).toEqual([]);
    expect(stored.signals.map((s) => s.code)).not.toContain('MATCHES_CONFIRMED_INDICATOR');
    expect((await Case.findById(scamB.id).lean()).linkedCaseIds).toEqual([]);
  });

  it('37. students get 403 on the registry; the super admin gets 403 on lookup and the registry', async () => {
    await createSuperAdmin();
    const root = await ctx.as('root@platform.test');
    for (const [agent, method, path] of [
      [ctx.studentA, 'get', '/api/v1/staff/registry/recruiters'],
      [ctx.studentA, 'post', '/api/v1/staff/registry/recruiters'],
      [ctx.studentA, 'get', '/api/v1/staff/registry/indicators'],
      [root, 'get', '/api/v1/staff/registry/recruiters'],
      [root, 'get', '/api/v1/lookup?q=infosys.com'],
    ]) {
      const res = await agent[method](path).send({});
      expect([path, res.status]).toEqual([path, 403]);
    }
  });
});
