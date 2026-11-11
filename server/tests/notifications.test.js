'use strict';

const request = require('supertest');
const { useTestDatabase } = require('./helpers/db');
const { createTestApp } = require('./helpers/auth');
const { createSuperAdmin } = require('./helpers/factories');
const { setupDesk, createCaseAs } = require('./helpers/staffDesk');
const { plainCaseBody, fraudDecisionFor } = require('./helpers/registry');
const notifications = require('../src/services/notifications/notify');
const { Notification } = require('../src/models/Notification');
const { CaseEvent } = require('../src/models/CaseEvent');

useTestDatabase();

let app;
let ctx;
beforeAll(() => {
  app = createTestApp();
});
beforeEach(async () => {
  jest.spyOn(console, 'warn').mockImplementation(() => {});
  ctx = await setupDesk(app);
  // setupDesk already created cases (and their notifications); start each test clean.
  await Notification.collection.deleteMany({});
});

const ids = (...users) => users.map((user) => String(user._id)).sort();
async function recipients(type) {
  return (await Notification.find({ type }).lean()).map((item) => String(item.userId)).sort();
}
const casePath = (id, suffix) => `/api/v1/staff/cases/${id}${suffix}`;

describe('12. notification triggers', () => {
  it('case created → all active staff (not the disabled officer)', async () => {
    const created = await createCaseAs(ctx.studentA, plainCaseBody('n1'));
    expect(await recipients('case_submitted')).toEqual(ids(ctx.alpha.head, ctx.alpha.officer, ctx.alpha.officer2));
    const item = await Notification.findOne({ type: 'case_submitted' }).lean();
    expect(item).toMatchObject({ link: `/staff/cases/${created.id}`, refType: 'case' });
    expect(item.title).toContain(created.caseNumber);
  });

  it('student reply → all staff when unassigned, only the assignee when assigned', async () => {
    const created = await createCaseAs(ctx.studentA, plainCaseBody('n2'));
    await Notification.collection.deleteMany({});
    await ctx.studentA.post(`/api/v1/cases/${created.id}/messages`).send({ body: 'More details here.' });
    expect(await recipients('case_student_reply')).toEqual(ids(ctx.alpha.head, ctx.alpha.officer, ctx.alpha.officer2));

    await Notification.collection.deleteMany({});
    await ctx.officerA.patch(casePath(created.id, '/assign')).send({ assigneeId: String(ctx.alpha.officer._id) });
    expect(await recipients('case_assigned')).toEqual([]); // the actor assigned themselves
    await ctx.studentA.post(`/api/v1/cases/${created.id}/messages`).send({ body: 'Another detail.' });
    expect(await recipients('case_student_reply')).toEqual(ids(ctx.alpha.officer));
  });

  it('info request, staff message, decision and reopen → the student only', async () => {
    const created = await createCaseAs(ctx.studentA, plainCaseBody('n3', { contacts: { emails: [], phones: [], upiIds: ['n3.pay@ybl'] } }));
    await Notification.collection.deleteMany({});
    await ctx.officerA.post(casePath(created.id, '/info-request')).send({ message: 'Please send the full chat.' });
    await ctx.officerA.post(casePath(created.id, '/messages')).send({ body: 'Thanks for the update.' });
    await ctx.headA.post(casePath(created.id, '/decision')).send(fraudDecisionFor([{ type: 'upi', value: 'n3.pay@ybl' }]));
    await ctx.headA.post(casePath(created.id, '/reopen')).send({ reason: 'Checking new information again.' });

    for (const type of ['case_info_requested', 'case_staff_message', 'case_decision', 'case_reopened']) {
      expect([type, await recipients(type)]).toEqual([type, ids(ctx.alpha.student)]);
    }
    const all = await Notification.find({ userId: ctx.alpha.student._id }).lean();
    expect(all.every((item) => item.link === `/student/requests/${created.id}`)).toBe(true);
  });

  it('assignment by the head → the new assignee; recommendation → all active TPO heads except the actor', async () => {
    const created = await createCaseAs(ctx.studentA, plainCaseBody('n4'));
    await Notification.collection.deleteMany({});
    await ctx.headA.patch(casePath(created.id, '/assign')).send({ assigneeId: String(ctx.alpha.officer2._id) });
    expect(await recipients('case_assigned')).toEqual(ids(ctx.alpha.officer2));

    await ctx.officerA.post(casePath(created.id, '/recommendation')).send({ type: 'inconclusive', basis: 'Company did not respond.' });
    expect(await recipients('case_recommendation')).toEqual(ids(ctx.alpha.head));
    await Notification.collection.deleteMany({});
    await ctx.headA.post(casePath(created.id, '/recommendation')).send({ type: 'inconclusive', basis: 'Head adds own note.' });
    expect(await recipients('case_recommendation')).toEqual([]);
  });
});

describe('13. no internal information reaches the student', () => {
  it("the student's notifications contain only template text and the truncated student message", async () => {
    const created = await createCaseAs(ctx.studentA, plainCaseBody('leak', { contacts: { emails: [], phones: [], upiIds: ['leak.pay@ybl'] } }));
    const studentMessage = `This offer is fraudulent. Do not pay anything. ${'Please stay alert and report similar messages. '.repeat(8)}`.slice(0, 900);
    const secrets = ['SECRET-NOTE-BODY', 'SECRET-RECO-BASIS', 'SECRET-DECISION-BASIS-xyz', 'SECRET-REOPEN-REASON'];

    await ctx.officerA.post(casePath(created.id, '/notes')).send({ body: `${secrets[0]} internal only` });
    await ctx.officerA.post(casePath(created.id, '/recommendation')).send({ type: 'confirmed_fraud', basis: `${secrets[1]} details` });
    await ctx.officerA.post(casePath(created.id, '/info-request')).send({ message: 'Please share the original screenshot.' });
    await ctx.headA.post(casePath(created.id, '/decision')).send(
      fraudDecisionFor([{ type: 'upi', value: 'leak.pay@ybl' }], { basis: `${secrets[2]} called the official HR line and confirmed.`, checks: ['called_official_number', 'mca_or_gst_lookup'], studentMessage }),
    );
    await ctx.headA.post(casePath(created.id, '/reopen')).send({ reason: `${secrets[3]} new evidence` });

    const res = await ctx.studentA.get('/api/v1/notifications?limit=50');
    const text = res.text;
    for (const secret of [...secrets, 'mca_or_gst_lookup', 'called_official_number', 'signals', 'related']) expect(text).not.toContain(secret);
    const decision = res.body.notifications.find((item) => item.type === 'case_decision');
    expect(decision.body).toContain(studentMessage.replace(/\s+/g, ' ').trim().slice(0, 150));
    expect(decision.body.length).toBeLessThanOrEqual(300);
    expect(decision.body).not.toContain(studentMessage.slice(250));
    expect(res.body.notifications.find((item) => item.type === 'case_reopened').body).toBe('Your request has been reopened for further review.');
  });
});

describe('14-16. notification inbox API', () => {
  it('14. unread count, read, read-all, and other users or colleges get 404', async () => {
    await createCaseAs(ctx.studentA, plainCaseBody('i1'));
    await createCaseAs(ctx.studentA, plainCaseBody('i2'));
    const officer = ctx.officerA;

    expect((await officer.get('/api/v1/notifications/unread-count')).body.unreadCount).toBe(2);
    const list = await officer.get('/api/v1/notifications');
    expect(list.body).toMatchObject({ total: 2, unreadCount: 2 });
    const [first] = list.body.notifications;
    expect(Object.keys(first).sort()).toEqual(['body', 'createdAt', 'id', 'link', 'read', 'title', 'type']);

    expect((await ctx.headA.post(`/api/v1/notifications/${first.id}/read`).send({})).status).toBe(404);
    expect((await ctx.headB.post(`/api/v1/notifications/${first.id}/read`).send({})).status).toBe(404);
    expect((await officer.post(`/api/v1/notifications/${first.id}/read`).send({})).status).toBe(200);
    expect((await officer.post(`/api/v1/notifications/${first.id}/read`).send({})).status).toBe(200);
    expect((await officer.get('/api/v1/notifications/unread-count')).body.unreadCount).toBe(1);
    expect((await officer.get('/api/v1/notifications?unread=true')).body.total).toBe(1);

    expect((await officer.post('/api/v1/notifications/read-all').send({})).body).toEqual({ updated: 1 });
    expect((await officer.get('/api/v1/notifications/unread-count')).body.unreadCount).toBe(0);
    // The head's own notifications were untouched.
    expect((await ctx.headA.get('/api/v1/notifications/unread-count')).body.unreadCount).toBe(2);
    expect((await ctx.headB.get('/api/v1/notifications')).body.total).toBe(0);
    expect((await officer.post('/api/v1/notifications/not-an-id/read').send({})).status).toBe(404);
  });

  it('15. the super admin gets 403 and anonymous users 401', async () => {
    await createSuperAdmin();
    const root = await ctx.as('root@platform.test');
    expect((await root.get('/api/v1/notifications')).status).toBe(403);
    expect((await root.get('/api/v1/notifications/unread-count')).status).toBe(403);
    expect((await request(app).get('/api/v1/notifications')).status).toBe(401);
  });

  it('16. a failing notification never fails the main action', async () => {
    const created = await createCaseAs(ctx.studentA, plainCaseBody('f1'));
    const error = jest.spyOn(console, 'error').mockImplementation(() => {});
    jest.spyOn(notifications, 'notify').mockRejectedValue(Object.assign(new Error('db down'), { code: 'BOOM' }));

    const res = await ctx.officerA.post(casePath(created.id, '/messages')).send({ body: 'Message despite notification failure.' });

    expect(res.status).toBe(201);
    expect(await CaseEvent.countDocuments({ caseId: created.id, type: 'staff_message' })).toBe(1);
    expect(error).toHaveBeenCalledWith('[notify] failed: BOOM');
    expect(JSON.stringify(error.mock.calls)).not.toContain('db down');
  });
});
