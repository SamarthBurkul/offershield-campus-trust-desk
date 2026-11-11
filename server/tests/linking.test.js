'use strict';

const { useTestDatabase } = require('./helpers/db');
const { createTestApp } = require('./helpers/auth');
const { setupDesk, createCaseAs } = require('./helpers/staffDesk');
const { scamCaseBody, plainCaseBody, createRecruiter, SCAM_TEXT } = require('./helpers/registry');
const { Case } = require('../src/models/Case');
const { CaseEvent } = require('../src/models/CaseEvent');
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

const relatedOf = async (id) => (await Case.findById(id).lean()).related;
const staffView = async (id) => (await ctx.officerA.get(`/api/v1/staff/cases/${id}`)).body.case;

describe('related-case linking', () => {
  it('29. two cases sharing a UPI are linked both ways with the shared indicator', async () => {
    const a = await createCaseAs(ctx.studentA, plainCaseBody('a', { contacts: { emails: [], phones: [], upiIds: ['shared.pay@ybl'] } }));
    const b = await createCaseAs(ctx.studentA, plainCaseBody('b', { messageText: 'They asked me to pay shared.pay@ybl now.' }));

    const viewA = await staffView(a.id);
    expect(viewA.related).toEqual([
      expect.objectContaining({ caseId: b.id, caseNumber: b.caseNumber, reasons: ['shared_indicator'], sharedIndicators: [{ type: 'upi', value: 'shared.pay@ybl' }] }),
    ]);
    expect(viewA.linkedCaseIds).toEqual([b.id]);
    expect((await relatedOf(b.id)).map((entry) => String(entry.caseId))).toEqual([a.id]);
    const events = await CaseEvent.find({ type: 'linked' }).lean();
    expect(events).toHaveLength(2);
    expect(events.every((event) => event.visibleToStudent === false)).toBe(true);

    // The student never sees links.
    const student = await ctx.studentA.get(`/api/v1/cases/${a.id}`);
    expect(student.text).not.toMatch(/related|linkedCaseIds|textHash|linked/);
  });

  it('30. near-duplicate texts with different contacts are linked as similar_text', async () => {
    const a = await createCaseAs(ctx.studentA, scamCaseBody({ links: [], contacts: { emails: [], phones: [], upiIds: [] } }));
    const variant = SCAM_TEXT.replace('Rahul', 'Priya').replace('999', '1499').replace('infosys.onboard@ybl', 'other.fee@paytm').replace(
      'hr.infosys.careers@gmail.com',
      'talent.desk@outlook.com',
    );
    const b = await createCaseAs(ctx.studentA, scamCaseBody({ messageText: variant, links: [], contacts: { emails: [], phones: [], upiIds: [] } }));

    const [entry] = await relatedOf(a.id);
    expect(String(entry.caseId)).toBe(b.id);
    expect(entry.reasons).toEqual(['similar_text']);
    expect(entry.similarity).toBeGreaterThanOrEqual(0.9);
  });

  it('31. a shared free-mail domain or a verified recruiter domain does not link cases', async () => {
    await createRecruiter(ctx.headA);
    const a = await createCaseAs(ctx.studentA, plainCaseBody('c', { contacts: { emails: ['one.person@gmail.com', 'campus.hr@infosys.com'], phones: [], upiIds: [] } }));
    const b = await createCaseAs(ctx.studentA, plainCaseBody('d', { contacts: { emails: ['another.person@gmail.com'], phones: [], upiIds: [] }, links: ['https://careers.infosys.com/x'] }));

    expect(await relatedOf(a.id)).toEqual([]);
    expect(await relatedOf(b.id)).toEqual([]);
  });

  it('32. manual link and unlink work both ways and are audited; self-links are rejected', async () => {
    const a = await createCaseAs(ctx.studentA, plainCaseBody('e'));
    const b = await createCaseAs(ctx.studentA, plainCaseBody('f'));

    const linked = await ctx.officerA.post(`/api/v1/staff/cases/${a.id}/links`).send({ caseId: b.id });
    expect(linked.status).toBe(201);
    expect(linked.body.case.related).toEqual([expect.objectContaining({ caseId: b.id, reasons: ['manual'] })]);
    expect((await relatedOf(b.id)).map((entry) => entry.reasons)).toEqual([['manual']]);
    expect((await Case.findById(b.id).lean()).linkedCaseIds.map(String)).toEqual([a.id]);

    const self = await ctx.officerA.post(`/api/v1/staff/cases/${a.id}/links`).send({ caseId: a.id });
    expect(self.status).toBe(400);
    expect(self.body.error.code).toBe('INVALID_LINK');

    const unlinked = await ctx.headA.delete(`/api/v1/staff/cases/${b.id}/links/${a.id}`);
    expect(unlinked.status).toBe(200);
    expect(await relatedOf(a.id)).toEqual([]);
    expect((await Case.findById(a.id).lean()).linkedCaseIds).toEqual([]);
    expect((await ctx.headA.delete(`/api/v1/staff/cases/${b.id}/links/${a.id}`)).status).toBe(404);

    const actions = (await AuditLog.find({ action: /^case\.(un)?link$/ }).lean()).map((entry) => entry.action);
    expect(actions).toEqual(['case.link', 'case.unlink']);
  });

  it('33. queue items include relatedCount and topSignal', async () => {
    const a = await createCaseAs(ctx.studentA, scamCaseBody());
    await createCaseAs(ctx.studentA, scamCaseBody());

    const queue = await ctx.officerA.get('/api/v1/staff/cases?q=infosys');
    const row = queue.body.cases.find((item) => item.id === a.id);
    expect(row.relatedCount).toBe(1);
    expect(row.topSignal).toBe('FEE_REQUESTED');
    const plain = queue.body.cases.find((item) => item.id === ctx.caseA.id);
    expect(plain).toBeUndefined();
    const all = await ctx.officerA.get('/api/v1/staff/cases');
    expect(all.body.cases.find((item) => item.id === ctx.caseA.id)).toMatchObject({ relatedCount: 0 });
  });
});
