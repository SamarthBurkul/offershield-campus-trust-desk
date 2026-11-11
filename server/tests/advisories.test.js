'use strict';

const { useTestDatabase } = require('./helpers/db');
const { createTestApp } = require('./helpers/auth');
const { setupDesk, createCaseAs } = require('./helpers/staffDesk');
const { scamCaseBody, confirmFraud } = require('./helpers/registry');
const { FraudIndicator } = require('../src/models/FraudIndicator');
const { confirmedSource, advisoryBody, moreStudents } = require('./helpers/advisories');
const { verhoeffCheckDigit } = require('../src/utils/verhoeff');
const { Advisory } = require('../src/models/Advisory');
const { Acknowledgement } = require('../src/models/Acknowledgement');
const { Notification } = require('../src/models/Notification');
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

const staffBase = '/api/v1/staff/advisories';
const create = (agent, body) => agent.post(staffBase).send(body);
const publish = (id) => ctx.headA.post(`${staffBase}/${id}/publish`).send({});
const as = (email) => ctx.as(email);

async function publishedAdvisory(overrides) {
  const { indicatorIds, source } = await confirmedSource(ctx);
  const draft = await create(ctx.officerA, advisoryBody({ indicatorIds, sourceCaseId: source.id, ...overrides }));
  expect(draft.status).toBe(201);
  expect((await publish(draft.body.advisory.id)).status).toBe(200);
  return { id: draft.body.advisory.id, indicatorIds, source };
}

const advisoryNotificationsFor = async (advisoryId) =>
  (await Notification.find({ refType: 'advisory', refId: advisoryId }).lean()).map((item) => String(item.userId)).sort();

describe('advisory drafts and permissions', () => {
  it('3. officers draft; only the head publishes; only the author or head edits', async () => {
    const draft = await create(ctx.officerA, advisoryBody());
    expect(draft.status).toBe(201);
    expect(draft.body.advisory).toMatchObject({ status: 'draft', severity: 'critical', needsReview: false });

    const id = draft.body.advisory.id;
    expect((await ctx.officerA.post(`${staffBase}/${id}/publish`).send({})).status).toBe(403);
    const other = await as('officer2@demo-alpha.test.edu');
    expect((await other.patch(`${staffBase}/${id}`).send({ severity: 'info' })).status).toBe(403);
    expect((await ctx.officerA.patch(`${staffBase}/${id}`).send({ severity: 'info' })).status).toBe(200);
    expect((await ctx.headA.patch(`${staffBase}/${id}`).send({ title: 'Edited by the TPO head' })).body.advisory.title).toBe('Edited by the TPO head');
    expect(await AuditLog.countDocuments({ action: 'advisory.create' })).toBe(1);
    const updates = await AuditLog.find({ action: 'advisory.update' }).lean();
    expect(updates.map((entry) => entry.metadata.fields)).toEqual([['severity'], ['title']]);
  });

  it('4. validates branches, indicators, source case, student identity and sensitive IDs', async () => {
    const { indicatorIds, source } = await confirmedSource(ctx);
    const expectCode = async (body, status, code) => {
      const res = await create(ctx.officerA, advisoryBody(body));
      expect([res.status, res.body.error?.code]).toEqual([status, code]);
    };

    await expectCode({ target: { years: [], branches: ['ASTRO'] } }, 400, 'VALIDATION_ERROR');
    await expectCode({ target: { years: [6], branches: [] } }, 400, 'VALIDATION_ERROR');

    // Indicator of another college, and a revoked one.
    const studentB = await as('student@demo-beta.test.edu');
    const caseB = await createCaseAs(studentB, scamCaseBody());
    await confirmFraud(ctx.headB, caseB.id, [{ type: 'upi', value: 'infosys.onboard@ybl' }]);
    const indicatorB = await FraudIndicator.findOne({ collegeId: ctx.beta.college._id }).lean();
    await expectCode({ indicatorIds: [String(indicatorB._id)] }, 400, 'INVALID_INDICATOR');

    await expectCode({ sourceCaseId: ctx.caseA.id }, 400, 'INVALID_SOURCE_CASE'); // submitted, not confirmed_fraud
    await expectCode({ sourceCaseId: caseB.id }, 400, 'INVALID_SOURCE_CASE'); // other college

    const studentName = ctx.alpha.student.name;
    await expectCode({ sourceCaseId: source.id, body: `Reported by ${studentName.toUpperCase()}: do not pay the onboarding fee.` }, 400, 'CONTAINS_STUDENT_IDENTITY');
    await expectCode({ sourceCaseId: source.id, title: `Report from ${ctx.alpha.student.email}` }, 400, 'CONTAINS_STUDENT_IDENTITY');

    const base = '23456789012';
    await expectCode({ body: `Never share your Aadhaar ${base}${verhoeffCheckDigit(base)} with recruiters.` }, 400, 'SENSITIVE_ID_DETECTED');

    await ctx.headA.post(`/api/v1/staff/cases/${source.id}/reopen`).send({ reason: 'Re-checking the evidence again.' });
    await expectCode({ indicatorIds }, 400, 'INVALID_INDICATOR');
    expect(await Advisory.countDocuments()).toBe(0);
  });
});

describe('publishing and targeting', () => {
  it.each([
    ['year-only (4)', { years: [4], branches: [] }, ['y4comp', 'y4it']],
    ['branch-only (IT)', { years: [], branches: ['IT'] }, ['y4it', 'y1it']],
    ['combined (4 + COMP)', { years: [4], branches: ['COMP'] }, ['y4comp']],
    ['all students', { years: [], branches: [] }, ['y4comp', 'y4it', 'y1it', 'student', 'student2']],
  ])('5. %s notifies exactly the matching active students', async (_label, target, expectedKeys) => {
    const students = await moreStudents(ctx);
    const all = { ...students, student: ctx.alpha.student, student2: ctx.alpha.student2 };
    const { id } = await publishedAdvisory({ target });

    const advisory = await Advisory.findById(id).lean();
    expect(advisory).toMatchObject({ status: 'published', audienceCountAtPublish: expectedKeys.length });
    expect(String(advisory.publishedBy)).toBe(String(ctx.alpha.head._id));
    expect(await advisoryNotificationsFor(id)).toEqual(expectedKeys.map((key) => String(all[key]._id)).sort());
    // Staff, disabled students and college B never get it.
    const recipients = await Notification.find({ refType: 'advisory' }).lean();
    expect(recipients.every((item) => String(item.collegeId) === String(ctx.alpha.college._id))).toBe(true);
    expect(recipients.map((item) => String(item.userId))).not.toContain(String(students.disabled._id));
    expect(recipients.map((item) => String(item.userId))).not.toContain(String(ctx.alpha.head._id));

    const entry = await AuditLog.findOne({ action: 'advisory.publish' }).lean();
    expect(entry.metadata).toEqual({ audienceCount: expectedKeys.length, indicatorCount: 2 });
  });

  it('5b. the audience count endpoint matches the publish audience', async () => {
    await moreStudents(ctx);
    const res = await ctx.officerA.get(`${staffBase}/audience-count?years=4&branches=COMP`);
    expect(res.body.audienceCount).toBe(1);
    expect((await ctx.officerA.get(`${staffBase}/audience-count`)).body.audienceCount).toBe(5);
    expect((await ctx.officerA.get(`${staffBase}/audience-count?branches=ASTRO`)).status).toBe(400);
  });

  it('6. published advisories are immutable', async () => {
    const { id } = await publishedAdvisory();
    const res = await ctx.headA.patch(`${staffBase}/${id}`).send({ title: 'Changed after publishing' });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('ADVISORY_NOT_EDITABLE');
    expect((await publish(id)).status).toBe(409);
  });
});

describe('student access, acknowledgements and lifecycle', () => {
  it('7. students see only targeted, published, non-expired advisories', async () => {
    await moreStudents(ctx);
    const { id } = await publishedAdvisory({ target: { years: [4], branches: ['COMP'] } });
    const draft = await create(ctx.officerA, advisoryBody({ title: 'Draft only advisory' }));
    const expired = await publishedAdvisory({ title: 'Will expire soon advisory', expiresAt: new Date(Date.now() + 60_000).toISOString() });
    await Advisory.updateOne({ _id: expired.id }, { expiresAt: new Date(Date.now() - 1000) });

    const matching = await ctx.as('y4comp@demo-alpha.test.edu');
    const list = await matching.get('/api/v1/advisories');
    expect(list.body.advisories.map((item) => item.id)).toEqual([id]);
    expect(list.body.advisories[0]).toMatchObject({ severity: 'critical', acknowledged: false, indicators: [{ type: 'domain', value: 'infosys-careers.in' }, { type: 'upi', value: 'infosys.onboard@ybl' }] });

    const other = await ctx.as('y4it@demo-alpha.test.edu');
    expect((await other.get('/api/v1/advisories')).body.advisories).toEqual([]);
    expect((await other.get(`/api/v1/advisories/${id}`)).status).toBe(404);
    expect((await other.post(`/api/v1/advisories/${id}/ack`).send({})).status).toBe(404);
    expect((await matching.get(`/api/v1/advisories/${draft.body.advisory.id}`)).status).toBe(404);
    expect((await matching.get(`/api/v1/advisories/${expired.id}`)).status).toBe(404);
    expect((await ctx.officerA.get('/api/v1/advisories')).status).toBe(403);
  });

  it('8. acknowledging is idempotent and updates the ack rate and breakdown', async () => {
    const students = await moreStudents(ctx);
    const { id } = await publishedAdvisory({ target: { years: [4], branches: [] } });
    const y4comp = await ctx.as('y4comp@demo-alpha.test.edu');

    expect((await y4comp.post(`/api/v1/advisories/${id}/ack`).send({})).body).toEqual({ acknowledged: true });
    expect((await y4comp.post(`/api/v1/advisories/${id}/ack`).send({})).status).toBe(200);
    expect(await Acknowledgement.countDocuments({ advisoryId: id })).toBe(1);

    const detail = await ctx.headA.get(`${staffBase}/${id}`);
    expect(detail.body.advisory).toMatchObject({
      audienceCount: 2,
      acknowledgedCount: 1,
      ackRate: 0.5,
      acknowledgementBreakdown: { byYear: [{ year: 4, count: 1 }], byBranch: [{ branch: 'COMP', count: 1 }] },
    });
    expect(detail.text).not.toContain(students.y4comp.name);
    expect((await y4comp.get(`/api/v1/advisories/${id}`)).body.advisory.acknowledged).toBe(true);
  });

  it('9. a revoked indicator is hidden from students, flags needsReview and blocks publishing', async () => {
    const { id, source, indicatorIds } = await publishedAdvisory();
    const draft = await create(ctx.officerA, advisoryBody({ indicatorIds }));

    await ctx.headA.post(`/api/v1/staff/cases/${source.id}/reopen`).send({ reason: 'New evidence changes the picture.' });

    const student = await ctx.as('student@demo-alpha.test.edu');
    expect((await student.get(`/api/v1/advisories/${id}`)).body.advisory.indicators).toEqual([]);
    const list = await ctx.officerA.get(staffBase);
    expect(list.body.advisories.find((item) => item.id === id).needsReview).toBe(true);
    const res = await publish(draft.body.advisory.id);
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('INVALID_INDICATOR');
  });

  it('10. withdrawing hides the advisory; notified students see the withdrawn state', async () => {
    const { id } = await publishedAdvisory({ target: { years: [2], branches: [] } });
    const res = await ctx.headA.post(`${staffBase}/${id}/withdraw`).send({ reason: 'Company confirmed the domain was a typo.' });
    expect(res.status).toBe(200);
    expect(res.body.advisory.status).toBe('withdrawn');

    const student = await ctx.as('student@demo-alpha.test.edu');
    expect((await student.get('/api/v1/advisories')).body.advisories).toEqual([]);
    expect((await student.get(`/api/v1/advisories/${id}`)).body).toEqual({ advisory: { id, status: 'withdrawn' } });
    expect((await student.post(`/api/v1/advisories/${id}/ack`).send({})).status).toBe(404);
    const notNotified = await moreStudents(ctx).then(() => ctx.as('y4it@demo-alpha.test.edu'));
    expect((await notNotified.get(`/api/v1/advisories/${id}`)).status).toBe(404);
    expect(await AuditLog.countDocuments({ action: 'advisory.withdraw' })).toBe(1);
    expect((await ctx.headA.post(`${staffBase}/${id}/withdraw`).send({ reason: 'Trying to withdraw twice.' })).status).toBe(409);
  });

  it('11. student JSON never contains sourceCaseId, authors or their ids', async () => {
    const { id, source } = await publishedAdvisory();
    const student = await ctx.as('student2@demo-alpha.test.edu');
    const list = await student.get('/api/v1/advisories');
    const detail = await student.get(`/api/v1/advisories/${id}`);
    for (const res of [list, detail]) {
      for (const forbidden of ['sourceCaseId', source.id, 'createdBy', 'publishedBy', String(ctx.alpha.officer._id), String(ctx.alpha.head._id), ctx.alpha.officer.name, ctx.alpha.head.name]) {
        expect(res.text).not.toContain(forbidden);
      }
    }
  });
});
