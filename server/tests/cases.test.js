'use strict';

const http = require('node:http');
const https = require('node:https');
const dns = require('node:dns');
const { useTestDatabase } = require('./helpers/db');
const { createTestApp } = require('./helpers/auth');
const { validCaseBody, setupTwoColleges, createCaseAs } = require('./helpers/cases');
const { createSuperAdmin } = require('./helpers/factories');
const { Case } = require('../src/models/Case');
const { CaseEvent } = require('../src/models/CaseEvent');

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

const studentA = () => ctx.as('student@demo-alpha.test.edu');

describe('POST /cases', () => {
  it('1. creates a case with a college-scoped number, session-derived ids, status submitted and a created event', async () => {
    const res = await (await studentA()).post('/api/v1/cases').send(validCaseBody());

    expect(res.status).toBe(201);
    expect(res.body.case).toMatchObject({ caseNumber: 'OS-DEMO-ALPHA-0001', status: 'submitted', claimedCompany: 'Tata Consultancy Services' });
    const stored = await Case.findById(res.body.case.id).lean();
    expect(String(stored.collegeId)).toBe(String(ctx.alpha.college._id));
    expect(String(stored.studentId)).toBe(String(ctx.alpha.student._id));
    expect(stored.consentAt).toBeInstanceOf(Date);
    const events = await CaseEvent.find({ caseId: stored._id }).lean();
    expect(events).toEqual([expect.objectContaining({ type: 'created', visibleToStudent: true, actorRole: 'student' })]);
    expect(res.body.case.indicators).toEqual(
      expect.arrayContaining([
        { type: 'upi', value: 'hr.pay@okaxis', source: 'extracted' },
        { type: 'email', value: 'hr@tcs-careers.in', source: 'student_entered' },
        { type: 'phone', value: '+919876543210', source: 'student_entered' },
        { type: 'domain', value: 'tcs-careers.in', source: 'student_entered' },
        { type: 'url', value: 'https://tcs-careers.in/offer', source: 'extracted' },
      ]),
    );
  });

  it('2. numbers cases per college independently', async () => {
    const a = await studentA();
    const b = await ctx.as('student@demo-beta.test.edu');

    const first = await createCaseAs(a);
    const fromB = await createCaseAs(b);
    const second = await createCaseAs(a);

    expect([first.caseNumber, second.caseNumber]).toEqual(['OS-DEMO-ALPHA-0001', 'OS-DEMO-ALPHA-0002']);
    expect(fromB.caseNumber).toBe('OS-DEMO-BETA-0001');
  });

  it('3. sets priority high when money was requested or already paid, otherwise normal', async () => {
    const agent = await studentA();
    const normal = await createCaseAs(agent);
    const requested = await createCaseAs(agent, { moneyRequested: { requested: true, amount: 499, purpose: 'registration' } });
    const paid = await createCaseAs(agent, { paidAlready: true });

    const priorities = await Promise.all([normal, requested, paid].map(async (c) => (await Case.findById(c.id).lean()).priority));
    expect(priorities).toEqual(['normal', 'high', 'high']);
    expect(requested.moneyRequested).toEqual({ requested: true, amount: 499, purpose: 'registration' });
  });

  it.each([
    ['collegeId', { collegeId: '507f1f77bcf86cd799439011' }],
    ['studentId', { studentId: '507f1f77bcf86cd799439011' }],
    ['status', { status: 'verified_genuine' }],
    ['priority', { priority: 'high' }],
    ['assigneeId', { assigneeId: '507f1f77bcf86cd799439011' }],
    ['decision', { decision: { type: 'verified_genuine' } }],
  ])('4. rejects a body containing %s and creates nothing', async (_key, extra) => {
    const res = await (await studentA()).post('/api/v1/cases').send(validCaseBody(extra));

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(await Case.countDocuments()).toBe(0);
  });

  it.each([
    ['consent missing', { consent: undefined }],
    ['consent false', { consent: false }],
    ['messageText too short', { messageText: 'short' }],
    ['messageText too long', { messageText: 'x'.repeat(5001) }],
    ['javascript: link', { links: ['javascript:alert(1)'] }],
    ['ftp: link', { links: ['ftp://files.example.com/offer'] }],
    ['more than 10 links', { links: Array.from({ length: 11 }, (_, i) => `https://x${i}.example.com`) }],
    ['invalid channel', { channel: 'carrier_pigeon' }],
    ['future receivedAt', { receivedAt: new Date(Date.now() + 2 * 24 * 3600 * 1000).toISOString() }],
  ])('5. rejects %s with 400 VALIDATION_ERROR', async (_label, overrides) => {
    const res = await (await studentA()).post('/api/v1/cases').send(validCaseBody(overrides));

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(await Case.countDocuments()).toBe(0);
  });

  it('6. never fetches or resolves submitted links during creation and reply', async () => {
    const agent = await studentA();
    const hosts = ['never-fetch-me.xyz', 'also-not-fetched.in', 'reply-link.online'];
    const fetchSpy = jest.fn();
    const originalFetch = globalThis.fetch;
    globalThis.fetch = fetchSpy;
    const httpSpy = jest.spyOn(http, 'request');
    const httpsSpy = jest.spyOn(https, 'request');
    const dnsSpy = jest.spyOn(dns, 'lookup');
    const dnsPromisesSpy = jest.spyOn(dns.promises, 'lookup');

    try {
      const created = await createCaseAs(agent, {
        links: [`https://${hosts[0]}/apply`],
        messageText: `Visit http://${hosts[1]}/pay now to confirm your seat`,
      });
      const reply = await agent.post(`/api/v1/cases/${created.id}/messages`).send({ body: `They also sent https://${hosts[2]}/x` });
      expect(reply.status).toBe(201);
    } finally {
      globalThis.fetch = originalFetch;
    }

    expect(fetchSpy).not.toHaveBeenCalled();
    // Supertest itself talks to the app over local HTTP, so only calls mentioning submitted hosts count.
    const calls = [httpSpy, httpsSpy, dnsSpy, dnsPromisesSpy].flatMap((spy) => spy.mock.calls);
    const touched = calls.filter((args) => hosts.some((host) => JSON.stringify(args, (_k, v) => (typeof v === 'function' ? undefined : v)).includes(host)));
    expect(touched).toEqual([]);
    expect(httpsSpy).not.toHaveBeenCalled();
    // The only lookups are Supertest resolving its own loopback connection to the app.
    expect(dnsSpy.mock.calls.every(([host]) => host === '127.0.0.1' || host === 'localhost' || host === '::1')).toBe(true);
    expect(dnsPromisesSpy).not.toHaveBeenCalled();
  });

  it('7. staff and super admin get 403 on POST /cases', async () => {
    await createSuperAdmin();
    for (const email of ['officer@demo-alpha.test.edu', 'head@demo-alpha.test.edu', 'root@platform.test']) {
      const res = await (await ctx.as(email)).post('/api/v1/cases').send(validCaseBody());
      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
    }
    expect(await Case.countDocuments()).toBe(0);
  });

  it('13. returns 429 after the per-user creation limit', async () => {
    const limitedApp = createTestApp({ CASE_CREATE_LIMIT_PER_HOUR: '2' });
    const { loginAgent } = require('./helpers/auth');
    const agent = await loginAgent(limitedApp, 'student@demo-alpha.test.edu', 'TestPassw0rd-1');
    const other = await loginAgent(limitedApp, 'student2@demo-alpha.test.edu', 'TestPassw0rd-1');

    expect((await agent.post('/api/v1/cases').send(validCaseBody())).status).toBe(201);
    expect((await agent.post('/api/v1/cases').send(validCaseBody())).status).toBe(201);
    const limited = await agent.post('/api/v1/cases').send(validCaseBody());

    expect(limited.status).toBe(429);
    expect(limited.body.error.code).toBe('RATE_LIMITED');
    // The limit is per account, not per IP.
    expect((await other.post('/api/v1/cases').send(validCaseBody())).status).toBe(201);
  });
});

describe('GET /cases/mine and /cases/:id', () => {
  it('8. lists only the caller’s cases, newest first and paginated', async () => {
    const a = await studentA();
    const a2 = await ctx.as('student2@demo-alpha.test.edu');
    const mine = [];
    for (let i = 0; i < 3; i += 1) mine.push(await createCaseAs(a, { claimedCompany: `Company ${i}` }));
    await createCaseAs(a2);

    const page1 = await a.get('/api/v1/cases/mine?limit=2&page=1');
    const page2 = await a.get('/api/v1/cases/mine?limit=2&page=2');

    expect(page1.status).toBe(200);
    expect(page1.body).toMatchObject({ page: 1, limit: 2, total: 3 });
    expect(page1.body.cases.map((c) => c.claimedCompany)).toEqual(['Company 2', 'Company 1']);
    expect(page2.body.cases.map((c) => c.claimedCompany)).toEqual(['Company 0']);
    expect(Object.keys(page1.body.cases[0]).sort()).toEqual(
      ['caseNumber', 'channel', 'claimedCompany', 'createdAt', 'id', 'lastActivityAt', 'receivedAt', 'status'].sort(),
    );
    expect((await a.get('/api/v1/cases/mine?limit=51')).status).toBe(400);
    expect((await a.get('/api/v1/cases/mine?status=dismissed')).body.total).toBe(0);
  });

  it('9. another student of the same college and a student of another college get 404', async () => {
    const created = await createCaseAs(await studentA());

    const sameCollege = await (await ctx.as('student2@demo-alpha.test.edu')).get(`/api/v1/cases/${created.id}`);
    const otherCollege = await (await ctx.as('student@demo-beta.test.edu')).get(`/api/v1/cases/${created.id}`);

    expect(sameCollege.status).toBe(404);
    expect(otherCollege.status).toBe(404);
    expect(sameCollege.body).toEqual(otherCollege.body);
    expect((await (await studentA()).get('/api/v1/cases/not-an-id')).status).toBe(404);
  });

  it('10. the student view excludes staff-only fields and hidden events', async () => {
    const agent = await studentA();
    const created = await createCaseAs(agent);
    await Case.updateOne(
      { _id: created.id },
      {
        assigneeId: ctx.alpha.officer._id,
        signals: [{ kind: 'test' }],
        linkedCaseIds: [ctx.alpha.officer._id],
        decision: { type: 'confirmed_fraud', basis: 'Registry match', decidedBy: ctx.alpha.head._id, decidedAt: new Date() },
      },
    );
    await CaseEvent.create({
      collegeId: ctx.alpha.college._id,
      caseId: created.id,
      type: 'staff_message',
      actorId: ctx.alpha.officer._id,
      actorRole: 'placement_officer',
      body: 'STAFF ONLY: suspect matches registry',
      visibleToStudent: false,
    });

    const res = await agent.get(`/api/v1/cases/${created.id}`);

    expect(res.status).toBe(200);
    for (const key of ['assigneeId', 'signals', 'linkedCaseIds', 'priority', 'studentId', 'collegeId']) {
      expect(res.body.case).not.toHaveProperty(key);
    }
    // Phase 4 contract: students only get { type, decidedAt, message }.
    expect(res.body.case.decision).toEqual({ type: 'confirmed_fraud', decidedAt: expect.any(String), message: null });
    expect(res.text).not.toContain('Registry match');
    expect(res.text).not.toContain('STAFF ONLY');
    expect(res.text).not.toContain(String(ctx.alpha.officer._id));
    expect(res.text).not.toContain(String(ctx.alpha.head._id));
    expect(res.body.events.map((event) => event.type)).toEqual(['created']);
    expect(res.body.evidence).toEqual([]);
  });
});

describe('POST /cases/:id/messages', () => {
  it('11. adds a visible reply, refuses closed cases and moves awaiting_student back to under_review', async () => {
    const agent = await studentA();
    const created = await createCaseAs(agent);

    const reply = await agent.post(`/api/v1/cases/${created.id}/messages`).send({ body: 'Here is more detail about the call.' });
    expect(reply.status).toBe(201);
    expect(reply.body.events.map((event) => event.type)).toEqual(['created', 'student_message']);
    expect(reply.body.events[1]).toMatchObject({ actor: 'student', body: 'Here is more detail about the call.' });

    await Case.updateOne({ _id: created.id }, { status: 'awaiting_student' });
    const answer = await agent.post(`/api/v1/cases/${created.id}/messages`).send({ body: 'Answering your question.' });
    expect(answer.body.case.status).toBe('under_review');
    expect(answer.body.events.at(-1)).toMatchObject({ type: 'status_changed', body: expect.stringMatching(/under review/) });
    // Phase 4 contract: event metadata is never sent to students.
    expect(answer.body.events.every((event) => !('metadata' in event))).toBe(true);

    await Case.updateOne({ _id: created.id }, { status: 'dismissed' });
    const closed = await agent.post(`/api/v1/cases/${created.id}/messages`).send({ body: 'Anything?' });
    expect(closed.status).toBe(409);
    expect(closed.body.error.code).toBe('CASE_CLOSED');

    const other = await (await ctx.as('student2@demo-alpha.test.edu')).post(`/api/v1/cases/${created.id}/messages`).send({ body: 'hi there' });
    expect(other.status).toBe(404);
  });

  it('12. a reply with a new UPI ID adds it to the indicators', async () => {
    const agent = await studentA();
    const created = await createCaseAs(agent);

    const res = await agent.post(`/api/v1/cases/${created.id}/messages`).send({ body: 'Now they want payment to fees.desk@ybl instead.' });

    expect(res.body.case.indicators).toEqual(expect.arrayContaining([{ type: 'upi', value: 'fees.desk@ybl', source: 'extracted' }]));
    expect(res.body.case.indicators.length).toBe(created.indicators.length + 1);
  });
});
