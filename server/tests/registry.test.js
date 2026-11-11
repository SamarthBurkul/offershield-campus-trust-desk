'use strict';

const { useTestDatabase } = require('./helpers/db');
const { createTestApp } = require('./helpers/auth');
const { setupDesk, createCaseAs } = require('./helpers/staffDesk');
const { recruiterBody, scamCaseBody, createRecruiter, confirmFraud } = require('./helpers/registry');
const { Recruiter } = require('../src/models/Recruiter');
const { AuditLog } = require('../src/models/AuditLog');

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

const base = '/api/v1/staff/registry/recruiters';

describe('recruiter registry', () => {
  it('15. officer-created recruiters are pending until the head approves', async () => {
    const created = await createRecruiter(ctx.officerA, { expiresInDays: 90 });
    expect(created).toMatchObject({
      status: 'pending_approval',
      domains: ['infosys.com'],
      contactEmails: ['campus.hr@infosys.com'],
      contactPhones: ['+919111122222'],
      verification: { verifiedBy: null, verifiedAt: null, expiresAt: null, validForDays: 90 },
    });

    const approved = await ctx.headA.post(`${base}/${created.id}/approve`).send({});
    expect(approved.status).toBe(200);
    expect(approved.body.recruiter).toMatchObject({ status: 'verified', isExpired: false, verification: { verifiedBy: { id: String(ctx.alpha.head._id) } } });
    const days = (new Date(approved.body.recruiter.verification.expiresAt) - Date.now()) / 86_400_000;
    expect(days).toBeGreaterThan(89);
    expect(days).toBeLessThanOrEqual(90);
    expect((await ctx.headA.post(`${base}/${created.id}/approve`).send({})).status).toBe(409);

    const byHead = await createRecruiter(ctx.headA, { companyName: 'Wipro', domains: ['wipro.com'], contactEmails: [], contactPhones: [] });
    expect(byHead.status).toBe('verified');
    const defaultDays = (new Date(byHead.verification.expiresAt) - Date.now()) / 86_400_000;
    expect(Math.round(defaultDays)).toBe(365);
  });

  it('16. rejects free-mail contacts, contacts on unlisted domains and confirmed fraud domains', async () => {
    const freeMail = await ctx.headA.post(base).send(recruiterBody({ contactEmails: ['infosys.hr@gmail.com'] }));
    expect(freeMail.status).toBe(400);
    expect(freeMail.body.error.code).toBe('FREE_MAIL_NOT_ALLOWED');

    const freeDomain = await ctx.headA.post(base).send(recruiterBody({ domains: ['gmail.com'], contactEmails: [] }));
    expect(freeDomain.body.error.code).toBe('FREE_MAIL_NOT_ALLOWED');

    const unlisted = await ctx.headA.post(base).send(recruiterBody({ contactEmails: ['hr@infosys-mail.com'] }));
    expect(unlisted.status).toBe(400);
    expect(unlisted.body.error.code).toBe('CONTACT_DOMAIN_MISMATCH');

    const subdomainContact = await ctx.headA.post(base).send(recruiterBody({ contactEmails: ['hr@careers.infosys.com'] }));
    expect(subdomainContact.status).toBe(201);

    const scam = await createCaseAs(ctx.studentA, scamCaseBody());
    await confirmFraud(ctx.headA, scam.id, [{ type: 'domain', value: 'infosys-careers.in' }]);
    const conflict = await ctx.headA.post(base).send(recruiterBody({ companyName: 'Fake', domains: ['infosys-careers.in'], contactEmails: [] }));
    expect(conflict.status).toBe(409);
    expect(conflict.body.error.code).toBe('CONFLICTS_WITH_FRAUD_INDICATOR');

    const badCase = await ctx.headA.post(base).send(recruiterBody({ companyName: 'Other', domains: ['other.com'], contactEmails: [], sourceCaseId: ctx.caseB.id }));
    expect(badCase.status).toBe(404);
    expect(await Recruiter.countDocuments()).toBe(1);
  });

  it('17. changing domains of a verified recruiter needs new verification and keeps history', async () => {
    const recruiter = await createRecruiter(ctx.headA);

    const missing = await ctx.headA.patch(`${base}/${recruiter.id}`).send({ domains: ['infosys.com', 'infosys.co.in'] });
    expect(missing.status).toBe(400);
    expect(missing.body.error.code).toBe('VERIFICATION_REQUIRED');

    const changed = await ctx.headA.patch(`${base}/${recruiter.id}`).send({
      domains: ['infosys.com', 'infosys.co.in'],
      methods: ['matched_official_domain'],
      evidenceNote: 'Confirmed the .co.in domain is listed on the official investor page.',
    });
    expect(changed.status).toBe(200);
    expect(changed.body.recruiter.domains).toEqual(['infosys.com', 'infosys.co.in']);
    expect(changed.body.recruiter.verification.methods).toEqual(['matched_official_domain']);
    expect(changed.body.recruiter.verificationHistory).toHaveLength(1);
    expect(changed.body.recruiter.verificationHistory[0].methods).toEqual(['called_official_number', 'checked_official_careers_page']);

    const renamed = await ctx.headA.patch(`${base}/${recruiter.id}`).send({ companyName: 'Infosys Ltd' });
    expect(renamed.body.recruiter.verificationHistory).toHaveLength(1);
    const audit = await AuditLog.find({ action: 'recruiter.update' }).lean();
    expect(audit.map((entry) => entry.metadata.fields)).toEqual([['domains', 'methods', 'evidenceNote'], ['companyName']]);
  });

  it('18. renew, suspend and audit; officers cannot approve, renew, suspend or edit verified records', async () => {
    const recruiter = await createRecruiter(ctx.headA);
    const pending = await createRecruiter(ctx.officerA, { companyName: 'Pending Co', domains: ['pending.com'], contactEmails: [], contactPhones: [] });

    for (const [path, body] of [
      [`${base}/${pending.id}/approve`, {}],
      [`${base}/${recruiter.id}/renew`, { methods: ['other'], evidenceNote: 'Officer trying to renew this record.' }],
      [`${base}/${recruiter.id}/suspend`, { reason: 'Officer trying to suspend.' }],
    ]) {
      expect((await ctx.officerA.post(path).send(body)).status).toBe(403);
    }
    expect((await ctx.officerA.patch(`${base}/${recruiter.id}`).send({ companyName: 'Hacked' })).status).toBe(403);
    // Officers may edit their own pending record, but not another officer's.
    expect((await ctx.officerA.patch(`${base}/${pending.id}`).send({ companyName: 'Pending Company' })).status).toBe(200);
    const officer2 = await ctx.as('officer2@demo-alpha.test.edu');
    expect((await officer2.patch(`${base}/${pending.id}`).send({ companyName: 'Nope' })).status).toBe(403);

    const renewed = await ctx.headA.post(`${base}/${recruiter.id}/renew`).send({
      methods: ['contacted_company_hr'],
      evidenceNote: 'Re-confirmed with campus HR by email from infosys.com.',
      expiresInDays: 180,
    });
    expect(renewed.status).toBe(200);
    expect(renewed.body.recruiter.verificationHistory).toHaveLength(1);
    expect(renewed.body.recruiter.verification.validForDays).toBe(180);

    const suspended = await ctx.headA.post(`${base}/${recruiter.id}/suspend`).send({ reason: 'Company asked us to pause campus hiring.' });
    expect(suspended.body.recruiter).toMatchObject({ status: 'suspended', suspendedReason: 'Company asked us to pause campus hiring.' });
    expect((await ctx.headA.post(`${base}/${recruiter.id}/renew`).send({ methods: ['other'], evidenceNote: 'Trying to renew suspended.' })).status).toBe(409);

    const actions = (await AuditLog.find({ action: /^recruiter\./ }).sort({ createdAt: 1 }).lean()).map((entry) => entry.action);
    expect(actions).toEqual(['recruiter.create', 'recruiter.create', 'recruiter.update', 'recruiter.renew', 'recruiter.suspend']);

    const list = await ctx.officerA.get(`${base}?q=infosys.com`);
    expect(list.body.recruiters.map((item) => item.companyName)).toEqual(['Infosys']);
    const pendingList = await ctx.officerA.get(`${base}?status=pending_approval`);
    expect(pendingList.body.recruiters.map((item) => item.companyName)).toEqual(['Pending Company']);
  });
});
