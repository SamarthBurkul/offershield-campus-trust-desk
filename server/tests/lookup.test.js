'use strict';

const { useTestDatabase } = require('./helpers/db');
const { createTestApp, loginAgent } = require('./helpers/auth');
const { setupDesk, createCaseAs } = require('./helpers/staffDesk');
const { scamCaseBody, createRecruiter, confirmFraud } = require('./helpers/registry');
const { GUIDANCE } = require('../src/services/lookup.service');
const { Recruiter } = require('../src/models/Recruiter');
const { LookupEvent } = require('../src/models/LookupEvent');

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

const lookup = (agent, q) => agent.get(`/api/v1/lookup?q=${encodeURIComponent(q)}`);

async function withFraud() {
  const scam = await createCaseAs(ctx.studentA, scamCaseBody());
  await confirmFraud(ctx.headA, scam.id, [
    { type: 'upi', value: 'infosys.onboard@ybl' },
    { type: 'domain', value: 'infosys-careers.in' },
  ]);
  return scam;
}

describe('GET /lookup', () => {
  it('19. a confirmed UPI returns confirmed_fraud without source cases or case data (students)', async () => {
    const scam = await withFraud();
    const res = await lookup(ctx.studentA, 'Infosys.Onboard@YBL');

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ resultStatus: 'confirmed_fraud', queryType: 'upi', fraudMatches: [{ type: 'upi', value: 'infosys.onboard@ybl', confirmedAt: expect.any(String) }] });
    expect(Object.keys(res.body.fraudMatches[0]).sort()).toEqual(['confirmedAt', 'type', 'value']);
    for (const forbidden of ['sourceCase', scam.id, scam.caseNumber, 'student', 'evidenceNote', 'verifiedBy']) expect(res.text).not.toContain(forbidden);

    // Staff get links to the source cases.
    const staff = await lookup(ctx.officerA, 'infosys.onboard@ybl');
    expect(staff.body.fraudMatches[0].sourceCases).toEqual([{ id: scam.id, caseNumber: scam.caseNumber }]);
  });

  it('20. an email on a confirmed fraud domain is confirmed_fraud', async () => {
    await withFraud();
    const res = await lookup(ctx.studentA, 'offers@apply.infosys-careers.in');
    expect(res.body).toMatchObject({ resultStatus: 'confirmed_fraud', queryType: 'email' });
    expect(res.body.fraudMatches.map((item) => item.value)).toContain('infosys-careers.in');

    const url = await lookup(ctx.studentA, 'https://www.infosys-careers.in/pay?x=1');
    expect(url.body).toMatchObject({ resultStatus: 'confirmed_fraud', queryType: 'url' });
  });

  it('21. subdomains, contact phones and company names of verified recruiters are verified', async () => {
    await createRecruiter(ctx.headA);
    const sub = await lookup(ctx.studentA, 'careers.infosys.com');
    expect(sub.body).toMatchObject({ resultStatus: 'verified', queryType: 'domain' });
    expect(sub.body.verifiedRecruiters[0]).toMatchObject({ companyName: 'Infosys', domains: ['infosys.com'], methods: ['called_official_number', 'checked_official_careers_page'], isExpired: false });
    expect(Object.keys(sub.body.verifiedRecruiters[0]).sort()).toEqual(['companyName', 'domains', 'expiresAt', 'id', 'isExpired', 'methods', 'verifiedAt']);

    expect((await lookup(ctx.studentA, '91111 22222')).body).toMatchObject({ resultStatus: 'verified', queryType: 'phone' });
    expect((await lookup(ctx.studentA, 'campus.hr@infosys.com')).body).toMatchObject({ resultStatus: 'verified', queryType: 'email' });
    expect((await lookup(ctx.studentA, 'infos')).body).toMatchObject({ resultStatus: 'verified', queryType: 'company' });
    expect((await lookup(ctx.studentA, 'https://careers.infosys.com/jobs')).body.resultStatus).toBe('verified');
  });

  it('22. a look-alike domain returns lookalike_warning with lookalikeOf', async () => {
    await createRecruiter(ctx.headA);
    const res = await lookup(ctx.studentA, 'inf0sys-careers.com');
    expect(res.body).toMatchObject({ resultStatus: 'lookalike_warning', lookalikeOf: [{ companyName: 'Infosys', domain: 'infosys.com' }] });
    expect((await lookup(ctx.studentA, 'hr@infosyss.com')).body.resultStatus).toBe('lookalike_warning');
  });

  it('23. expired is verified_expired; pending and suspended recruiters are not_reviewed', async () => {
    const recruiter = await createRecruiter(ctx.headA);
    await Recruiter.updateOne({ _id: recruiter.id }, { 'verification.expiresAt': new Date(Date.now() - 86_400_000) });
    const expired = await lookup(ctx.studentA, 'infosys.com');
    expect(expired.body).toMatchObject({ resultStatus: 'verified_expired', verifiedRecruiters: [{ isExpired: true }] });

    await createRecruiter(ctx.officerA, { companyName: 'Pending Co', domains: ['pending-co.com'], contactEmails: [], contactPhones: [] });
    expect((await lookup(ctx.studentA, 'pending-co.com')).body.resultStatus).toBe('not_reviewed');

    await ctx.headA.post(`/api/v1/staff/registry/recruiters/${recruiter.id}/suspend`).send({ reason: 'Paused campus hiring this term.' });
    const suspended = await lookup(ctx.studentA, 'infosys.com');
    expect(suspended.body).toMatchObject({ resultStatus: 'not_reviewed', verifiedRecruiters: [] });
  });

  it('24. a gmail address never matches a recruiter', async () => {
    await createRecruiter(ctx.headA, { companyName: 'Gmail Lovers', domains: ['gmailers.com'], contactEmails: [], contactPhones: [] });
    const res = await lookup(ctx.studentA, 'infosys.hr@gmail.com');
    expect(res.body).toMatchObject({ resultStatus: 'not_reviewed', queryType: 'email', verifiedRecruiters: [], lookalikeOf: [] });
  });

  it('25. unknown queries are not_reviewed; guidance never says "safe" (except "does not mean safe") or "genuine"', async () => {
    const res = await lookup(ctx.studentA, 'unknown-company-xyz.in');
    expect(res.body.resultStatus).toBe('not_reviewed');
    expect(res.body.guidance).toContain('does not mean safe');
    for (const text of Object.values(GUIDANCE)) {
      expect(text.replace('does not mean safe', '')).not.toMatch(/safe/i);
      expect(text).not.toMatch(/genuine/i);
    }
    expect((await lookup(ctx.studentA, 'Some Random Company')).body).toMatchObject({ resultStatus: 'not_reviewed', queryType: 'company', fraudMatches: [] });
  });

  it('26. confirmed_fraud takes precedence over lookalike_warning', async () => {
    await createRecruiter(ctx.headA);
    await withFraud();
    const res = await lookup(ctx.studentA, 'infosys-careers.in');
    expect(res.body.resultStatus).toBe('confirmed_fraud');
    expect(res.body.lookalikeOf).toEqual([{ companyName: 'Infosys', domain: 'infosys.com' }]);
  });

  it('27. stores a LookupEvent without the query text and rate-limits per user', async () => {
    await lookup(ctx.studentA, 'secret-query-text.in');
    const events = await LookupEvent.find().lean();
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ role: 'student', queryType: 'domain', resultStatus: 'not_reviewed' });
    expect(String(events[0].collegeId)).toBe(String(ctx.alpha.college._id));
    expect(JSON.stringify(events)).not.toContain('secret-query-text');

    const limitedApp = createTestApp({ LOOKUP_LIMIT_PER_10MIN: '2' });
    const agent = await loginAgent(limitedApp, 'student@demo-alpha.test.edu', 'TestPassw0rd-1');
    expect((await lookup(agent, 'abc.com')).status).toBe(200);
    expect((await lookup(agent, 'abc.com')).status).toBe(200);
    const limited = await lookup(agent, 'abc.com');
    expect(limited.status).toBe(429);
    expect(limited.body.error.code).toBe('RATE_LIMITED');

    expect((await lookup(ctx.studentA, 'ab')).status).toBe(400);
    expect((await ctx.studentA.get('/api/v1/lookup?q=abc.com&collegeId=x')).status).toBe(400);
  });

  it('28. revoked indicators are not returned', async () => {
    const scam = await withFraud();
    await ctx.headA.post(`/api/v1/staff/cases/${scam.id}/reopen`).send({ reason: 'New evidence from the student.' });

    const res = await lookup(ctx.studentA, 'infosys.onboard@ybl');
    expect(res.body).toMatchObject({ resultStatus: 'not_reviewed', fraudMatches: [] });
  });
});
