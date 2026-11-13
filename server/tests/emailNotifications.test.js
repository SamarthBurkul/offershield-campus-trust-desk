'use strict';

const { useTestDatabase } = require('./helpers/db');
const { createTestApp, createTestConfig } = require('./helpers/auth');
const { createUser } = require('./helpers/factories');
const { setupDesk, createCaseAs } = require('./helpers/staffDesk');
const { plainCaseBody, fraudDecisionFor } = require('./helpers/registry');
const { advisoryBody } = require('./helpers/advisories');
const { User } = require('../src/models/User');
const { EmailLog } = require('../src/models/EmailLog');
const email = require('../src/services/email');

useTestDatabase();

let app;
let ctx;
beforeAll(() => {
  app = createTestApp();
});
beforeEach(async () => {
  jest.spyOn(console, 'warn').mockImplementation(() => {});
  jest.spyOn(console, 'error').mockImplementation(() => {});
  email.configureEmail(createTestConfig());
  ctx = await setupDesk(app);
  await email.flushEmails();
  await EmailLog.collection.deleteMany({});
  email.getProvider().outbox.length = 0;
});
afterEach(() => jest.restoreAllMocks());

const casePath = (id, suffix) => `/api/v1/staff/cases/${id}${suffix}`;
const outbox = () => email.getProvider().outbox;
async function sentTo() {
  await email.flushEmails();
  return outbox().map((item) => `${item.to} | ${item.subject}`);
}

describe('student case emails (G13)', () => {
  test('info request, staff message, decision and reopen email the student with a deep link', async () => {
    const created = await createCaseAs(ctx.studentA, plainCaseBody('e1', { contacts: { emails: [], phones: [], upiIds: ['e1.pay@ybl'] } }));
    await email.flushEmails();
    outbox().length = 0;
    await ctx.officerA.post(casePath(created.id, '/info-request')).send({ message: 'Please send the full chat.' });
    await ctx.officerA.post(casePath(created.id, '/messages')).send({ body: 'Thanks for the update.' });
    await ctx.headA.post(casePath(created.id, '/decision')).send(fraudDecisionFor([{ type: 'upi', value: 'e1.pay@ybl' }]));
    await ctx.headA.post(casePath(created.id, '/reopen')).send({ reason: 'Checking new information again.' });

    expect(await sentTo()).toEqual([
      `student@demo-alpha.test.edu | More information needed for ${created.caseNumber}`,
      `student@demo-alpha.test.edu | New message on ${created.caseNumber}`,
      `student@demo-alpha.test.edu | Outcome recorded for ${created.caseNumber}`,
      `student@demo-alpha.test.edu | Request ${created.caseNumber} reopened`,
    ]);
    for (const item of outbox()) expect(item.text).toContain(`http://localhost:5173/student/requests/${created.id}`);
    const logs = await EmailLog.find({ userId: ctx.alpha.student._id }).sort({ createdAt: 1 }).lean();
    expect(logs.map((log) => [log.type, log.status])).toEqual([
      ['case_info_requested', 'sent'],
      ['case_staff_message', 'sent'],
      ['case_decision', 'sent'],
      ['case_reopened', 'sent'],
    ]);
    expect(logs.every((log) => String(log.collegeId) === String(ctx.alpha.college._id))).toBe(true);
  });

  test('no internal information reaches the email (leak test)', async () => {
    const created = await createCaseAs(ctx.studentA, plainCaseBody('leak', { contacts: { emails: [], phones: [], upiIds: ['leak.pay@ybl'] } }));
    const secrets = ['SECRET-NOTE-BODY', 'SECRET-RECO-BASIS', 'SECRET-DECISION-BASIS-xyz', 'SECRET-REOPEN-REASON', 'SECRET-STUDENT-MESSAGE', 'SECRET-INFO-REQUEST', 'SECRET-STAFF-MESSAGE'];
    await ctx.officerA.post(casePath(created.id, '/notes')).send({ body: `${secrets[0]} internal only` });
    await ctx.officerA.post(casePath(created.id, '/recommendation')).send({ type: 'confirmed_fraud', basis: `${secrets[1]} details` });
    await ctx.officerA.post(casePath(created.id, '/info-request')).send({ message: `${secrets[5]} please share.` });
    await ctx.officerA.post(casePath(created.id, '/messages')).send({ body: `${secrets[6]} hello.` });
    await ctx.headA.post(casePath(created.id, '/decision')).send(
      fraudDecisionFor([{ type: 'upi', value: 'leak.pay@ybl' }], {
        basis: `${secrets[2]} called the official HR line and confirmed.`,
        checks: ['called_official_number', 'mca_or_gst_lookup'],
        studentMessage: `${secrets[4]} This offer is not genuine. Do not pay.`,
      }),
    );
    await ctx.headA.post(casePath(created.id, '/reopen')).send({ reason: `${secrets[3]} new evidence` });
    await email.flushEmails();

    const everything = JSON.stringify(outbox()) + JSON.stringify(await EmailLog.find({}).lean());
    for (const secret of [...secrets, 'mca_or_gst_lookup', 'called_official_number', 'leak.pay@ybl', 'demo-beta']) expect(everything).not.toContain(secret);
    // Staff get only the case_submitted alert; the student gets the four case emails.
    const student = outbox().filter((item) => item.to === 'student@demo-alpha.test.edu');
    expect(student).toHaveLength(4);
  });

  test('opted-out students are logged as skipped_pref; unverified and disabled recipients get nothing', async () => {
    const created = await createCaseAs(ctx.studentA, plainCaseBody('e2'));
    await User.updateOne({ _id: ctx.alpha.student._id }, { $set: { 'emailPrefs.caseUpdates': false } });
    await email.flushEmails();
    outbox().length = 0;
    await EmailLog.collection.deleteMany({});
    await ctx.officerA.post(casePath(created.id, '/messages')).send({ body: 'Thanks for the update.' });
    expect(await sentTo()).toEqual([]);
    expect((await EmailLog.find({}).lean()).map((log) => [log.type, log.status])).toEqual([['case_staff_message', 'skipped_pref']]);

    await User.updateOne({ _id: ctx.alpha.student._id }, { $set: { 'emailPrefs.caseUpdates': true, emailVerifiedAt: null } });
    await EmailLog.collection.deleteMany({});
    await ctx.officerA.post(casePath(created.id, '/messages')).send({ body: 'Second message.' });
    expect(await sentTo()).toEqual([]);
    expect(await EmailLog.countDocuments()).toBe(0);
  });
});

describe('staff alert emails (G13)', () => {
  test('a new case emails active, verified staff who did not opt out', async () => {
    await User.updateOne({ _id: ctx.alpha.officer2._id }, { $set: { 'emailPrefs.staffAlerts': false } });
    const created = await createCaseAs(ctx.studentA, plainCaseBody('s1'));
    const recipients = (await sentTo()).filter((line) => line.includes(created.caseNumber)).map((line) => line.split(' | ')[0]).sort();
    expect(recipients).toEqual(['head@demo-alpha.test.edu', 'officer@demo-alpha.test.edu']);
    expect(await EmailLog.countDocuments({ type: 'case_submitted', status: 'skipped_pref' })).toBe(1);
    const message = outbox().find((item) => item.to === 'head@demo-alpha.test.edu');
    expect(message.text).toContain(`/staff/cases/${created.id}`);
    expect(message.text).not.toContain('student@demo-alpha.test.edu');
  });

  test('a pending registration emails staff without the student name or address', async () => {
    const { College } = require('../src/models/College');
    await College.updateOne({ _id: ctx.alpha.college._id }, { $set: { studentVerification: 'manual_approval' } });
    const request = require('supertest');
    const res = await request(app).post('/api/v1/auth/register').send({
      name: 'Pending Person',
      email: 'pending.person@gmail.com',
      password: 'StudentPass123',
      collegeCode: ctx.alpha.college.code,
      joinCode: 'TESTJOIN42',
      year: 2,
      branch: 'COMP',
      acceptPolicies: true,
    });
    expect(res.status).toBe(201);
    await email.flushEmails();
    const pending = outbox().filter((item) => item.subject === 'A student is waiting for approval');
    expect(pending.map((item) => item.to).sort()).toEqual(['head@demo-alpha.test.edu', 'officer2@demo-alpha.test.edu', 'officer@demo-alpha.test.edu']);
    expect(JSON.stringify(pending)).not.toMatch(/Pending Person|pending\.person/);
  });
});

describe('advisory emails (G13)', () => {
  async function publish(body) {
    const draft = await ctx.headA.post('/api/v1/staff/advisories').send(advisoryBody(body));
    expect(draft.status).toBe(201);
    const published = await ctx.headA.post(`/api/v1/staff/advisories/${draft.body.advisory.id}/publish`).send({});
    expect(published.status).toBe(200);
    await email.flushEmails();
    return draft.body.advisory.id;
  }

  test('critical/warning advisories email the audience and record "Emailed X of Y"; info advisories do not', async () => {
    const extra = await createUser({ college: ctx.alpha.college, role: 'student', email: 'optout@demo-alpha.test.edu', emailPrefs: { advisories: false } });
    const id = await publish({ severity: 'critical' });
    const recipients = outbox().filter((item) => item.subject.startsWith('Critical advisory')).map((item) => item.to);
    expect(recipients.sort()).toEqual(['student2@demo-alpha.test.edu', 'student@demo-alpha.test.edu']);
    const view = await ctx.headA.get(`/api/v1/staff/advisories/${id}`);
    expect(view.body.advisory.emailStats).toEqual({ sent: 2, audience: 3 });
    expect(await EmailLog.countDocuments({ type: 'advisory_published', status: 'skipped_pref', userId: extra._id })).toBe(1);

    outbox().length = 0;
    const infoId = await publish({ severity: 'info', title: 'General reminder for students' });
    expect(outbox()).toHaveLength(0);
    expect((await ctx.headA.get(`/api/v1/staff/advisories/${infoId}`)).body.advisory.emailStats).toBeNull();
  });

  test('the fan-out stops at the daily budget and reports what was sent', async () => {
    email.configureEmail(createTestConfig({ EMAIL_DAILY_BUDGET: '3' }));
    for (let i = 0; i < 6; i += 1) await createUser({ college: ctx.alpha.college, role: 'student', email: `bulk${i}@demo-alpha.test.edu` });
    const id = await publish({ severity: 'warning' });
    const view = await ctx.headA.get(`/api/v1/staff/advisories/${id}`);
    expect(view.body.advisory.emailStats.audience).toBe(8);
    expect(view.body.advisory.emailStats.sent).toBeLessThanOrEqual(3);
    expect(await EmailLog.countDocuments({ status: 'sent' })).toBeLessThanOrEqual(3);
    expect(await EmailLog.countDocuments({ status: 'skipped_budget' })).toBeGreaterThan(0);
  });

  test('a large audience is processed in batches of 50, five at a time', async () => {
    const docs = [];
    for (let i = 0; i < 120; i += 1) docs.push({ collegeId: ctx.alpha.college._id, role: 'student', name: `Bulk ${i}`, email: `many${i}@demo-alpha.test.edu`, year: 2, branch: 'COMP', status: 'active', authMethods: ['password'], emailVerifiedAt: new Date(), passwordHash: 'x', tokenVersion: 0, emailPrefs: { caseUpdates: true, advisories: true, staffAlerts: true } });
    await User.collection.insertMany(docs);
    const provider = email.getProvider();
    let inFlight = 0;
    let peak = 0;
    const original = provider.send;
    provider.send = async (message) => {
      inFlight += 1;
      peak = Math.max(peak, inFlight);
      await new Promise((resolve) => setImmediate(resolve));
      inFlight -= 1;
      return original(message);
    };
    const id = await publish({ severity: 'warning' });
    expect(peak).toBeLessThanOrEqual(5);
    expect(peak).toBeGreaterThan(1);
    expect((await ctx.headA.get(`/api/v1/staff/advisories/${id}`)).body.advisory.emailStats).toEqual({ sent: 122, audience: 122 });
  });
});
