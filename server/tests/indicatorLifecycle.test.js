'use strict';

const { useTestDatabase } = require('./helpers/db');
const { createTestApp } = require('./helpers/auth');
const { setupDesk, createCaseAs } = require('./helpers/staffDesk');
const { scamCaseBody, plainCaseBody, createRecruiter, confirmFraud, fraudDecisionFor } = require('./helpers/registry');
const { FraudIndicator } = require('../src/models/FraudIndicator');
const { Case } = require('../src/models/Case');
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

const UPI = { type: 'upi', value: 'infosys.onboard@ybl' };
const reopen = (id) => ctx.headA.post(`/api/v1/staff/cases/${id}/reopen`).send({ reason: 'Student sent new information to review.' });
const signalCodes = async (id) => (await Case.findById(id).lean()).signals.map((signal) => signal.code);

describe('fraud indicator lifecycle', () => {
  it('9. a confirmed_fraud decision publishes indicators; a second case adds a source without duplicating', async () => {
    const first = await createCaseAs(ctx.studentA, scamCaseBody());
    const second = await createCaseAs(ctx.studentA, scamCaseBody({ messageText: 'Different wording but same UPI infosys.onboard@ybl for the deposit.' }));

    await confirmFraud(ctx.headA, first.id, [UPI, { type: 'domain', value: 'infosys-careers.in' }]);
    const afterFirst = await FraudIndicator.find().lean();
    expect(afterFirst).toHaveLength(2);
    const upiDoc = afterFirst.find((item) => item.type === 'upi');
    expect(upiDoc).toMatchObject({ value: 'infosys.onboard@ybl', status: 'active' });
    expect(upiDoc.sourceCaseIds.map(String)).toEqual([first.id]);
    expect(String(upiDoc.createdBy)).toBe(String(ctx.alpha.head._id));

    await confirmFraud(ctx.headA, second.id, [UPI]);
    const upis = await FraudIndicator.find({ type: 'upi' }).lean();
    expect(upis).toHaveLength(1);
    expect(upis[0].sourceCaseIds.map(String).sort()).toEqual([first.id, second.id].sort());
    expect(upis[0].lastConfirmedAt.getTime()).toBeGreaterThanOrEqual(upis[0].firstConfirmedAt.getTime());
    expect(await AuditLog.countDocuments({ action: 'indicator.publish' })).toBe(3);
  });

  it('10. reopening removes the source; the last source reopened revokes the indicator', async () => {
    const first = await createCaseAs(ctx.studentA, scamCaseBody());
    const second = await createCaseAs(ctx.studentA, scamCaseBody());
    await confirmFraud(ctx.headA, first.id, [UPI]);
    await confirmFraud(ctx.headA, second.id, [UPI]);

    expect((await reopen(first.id)).status).toBe(200);
    let doc = await FraudIndicator.findOne({ type: 'upi' }).lean();
    expect(doc.status).toBe('active');
    expect(doc.sourceCaseIds.map(String)).toEqual([second.id]);

    expect((await reopen(second.id)).status).toBe(200);
    doc = await FraudIndicator.findOne({ type: 'upi' }).lean();
    expect(doc).toMatchObject({ status: 'revoked', revokeReason: 'source_case_reopened', sourceCaseIds: [] });
    expect(String(doc.revokedBy)).toBe(String(ctx.alpha.head._id));
    const audit = await AuditLog.findOne({ action: 'indicator.revoke' }).lean();
    expect(audit.metadata).toMatchObject({ type: 'upi', reason: 'source_case_reopened' });

    // Confirming again re-activates the same document.
    await confirmFraud(ctx.headA, second.id, [UPI]);
    expect(await FraudIndicator.countDocuments({ type: 'upi' })).toBe(1);
    expect((await FraudIndicator.findOne({ type: 'upi' }).lean()).status).toBe('active');
  });

  it('11. the head can revoke manually (audited); an officer cannot', async () => {
    const first = await createCaseAs(ctx.studentA, scamCaseBody());
    await confirmFraud(ctx.headA, first.id, [UPI]);
    const doc = await FraudIndicator.findOne({ type: 'upi' }).lean();
    const path = `/api/v1/staff/registry/indicators/${doc._id}/revoke`;

    const officer = await ctx.officerA.post(path).send({ reason: 'Bank confirmed account closed.' });
    expect(officer.status).toBe(403);

    const head = await ctx.headA.post(path).send({ reason: 'Bank confirmed account closed.' });
    expect(head.status).toBe(200);
    expect(await FraudIndicator.findById(doc._id).lean()).toMatchObject({ status: 'revoked', revokeReason: 'Bank confirmed account closed.' });
    const audit = await AuditLog.findOne({ action: 'indicator.revoke', entityId: doc._id }).lean();
    expect(audit.metadata).toMatchObject({ reason: 'manual' });
    expect(JSON.stringify(audit)).not.toContain('Bank confirmed');
    expect((await ctx.headA.post(path).send({ reason: 'Bank confirmed account closed.' })).status).toBe(409);
  });

  it('12. confirming a verified recruiter domain is blocked before any change', async () => {
    const recruiter = await createRecruiter(ctx.headA);
    const created = await createCaseAs(ctx.studentA, plainCaseBody('x', { links: ['https://careers.infosys.com/jobs'] }));
    const auditBefore = await AuditLog.countDocuments();

    const res = await ctx.headA
      .post(`/api/v1/staff/cases/${created.id}/decision`)
      .send(fraudDecisionFor([{ type: 'domain', value: 'careers.infosys.com' }]));

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('CONFLICTS_WITH_VERIFIED_RECRUITER');
    expect(res.body.error.message).toMatch(/Suspend that recruiter/);
    expect(res.body.error.details).toMatchObject({ recruiterId: recruiter.id, companyName: 'Infosys' });
    const after = await Case.findById(created.id).lean();
    expect(after.status).toBe('submitted');
    expect(after.decision).toBeNull();
    expect(await FraudIndicator.countDocuments()).toBe(0);
    expect(await AuditLog.countDocuments()).toBe(auditBefore);
  });

  it('13. open cases gain and lose MATCHES_CONFIRMED_INDICATOR as indicators are published and revoked', async () => {
    const decided = await createCaseAs(ctx.studentA, scamCaseBody());
    const open = await createCaseAs(ctx.studentA, plainCaseBody('y', { contacts: { emails: [], phones: [], upiIds: ['infosys.onboard@ybl'] } }));
    expect(await signalCodes(open.id)).not.toContain('MATCHES_CONFIRMED_INDICATOR');

    await confirmFraud(ctx.headA, decided.id, [UPI]);
    const staffView = await ctx.officerA.get(`/api/v1/staff/cases/${open.id}`);
    expect(staffView.body.case.signals[0]).toMatchObject({ code: 'MATCHES_CONFIRMED_INDICATOR', detail: { matches: [UPI] } });

    await reopen(decided.id);
    expect(await signalCodes(open.id)).not.toContain('MATCHES_CONFIRMED_INDICATOR');
  });

  it('14. there is no route that creates a fraud indicator', async () => {
    const res = await ctx.headA.post('/api/v1/staff/registry/indicators').send({ type: 'upi', value: 'x@ybl' });
    expect([404, 405]).toContain(res.status);
    expect(await FraudIndicator.countDocuments()).toBe(0);
  });
});
