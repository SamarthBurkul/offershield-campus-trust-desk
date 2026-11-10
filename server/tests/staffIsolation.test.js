'use strict';

const { useTestDatabase } = require('./helpers/db');
const { createTestApp } = require('./helpers/auth');
const { setupDesk, fraudDecision } = require('./helpers/staffDesk');
const { createSuperAdmin } = require('./helpers/factories');
const { Case } = require('../src/models/Case');
const { CaseEvent } = require('../src/models/CaseEvent');
const { Note } = require('../src/models/Note');

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

const ENDPOINTS = [
  ['get', '', undefined],
  ['patch', '/assign', () => ({ assigneeId: String(ctx.alpha.officer._id) })],
  ['patch', '/status', () => ({ status: 'under_review' })],
  ['post', '/info-request', () => ({ message: 'Please send the full screenshot.' })],
  ['post', '/messages', () => ({ body: 'Hello from another college' })],
  ['post', '/notes', () => ({ body: 'cross-college note' })],
  ['post', '/recommendation', () => ({ type: 'confirmed_fraud', basis: 'Looks like a scam to me.' })],
  ['post', '/decision', () => fraudDecision()],
  ['post', '/reopen', () => ({ reason: 'Trying to reopen another college case.' })],
];

describe('cross-college isolation on the staff desk', () => {
  it.each(ENDPOINTS)('21. college A head: %s /staff/cases/:id%s on a college B case -> 404', async (method, suffix, body) => {
    const before = await Case.findById(ctx.caseB.id).lean();
    let req = ctx.headA[method](`/api/v1/staff/cases/${ctx.caseB.id}${suffix}`);
    if (body) req = req.send(body());

    const res = await req;

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
    const after = await Case.findById(ctx.caseB.id).lean();
    expect(after).toEqual(before);
    expect(await CaseEvent.countDocuments({ caseId: ctx.caseB.id })).toBe(1);
    expect(await Note.countDocuments({ caseId: ctx.caseB.id })).toBe(0);
  });

  it('21b. a college A officer also gets 404 for the B case, including the evidence link', async () => {
    expect((await ctx.officerA.get(`/api/v1/staff/cases/${ctx.caseB.id}`)).status).toBe(404);
    expect((await ctx.officerA.post(`/api/v1/cases/${ctx.caseB.id}/evidence/507f1f77bcf86cd799439011/link`)).status).toBe(404);
  });

  it('22. students and the super admin get 403 on every /staff route', async () => {
    await createSuperAdmin();
    const root = await ctx.as('root@platform.test');
    const routes = [
      ['get', '/api/v1/staff/cases'],
      ['get', '/api/v1/staff/cases/counts'],
      ['get', `/api/v1/staff/cases/${ctx.caseA.id}`],
      ['post', `/api/v1/staff/cases/${ctx.caseA.id}/notes`],
      ['post', `/api/v1/staff/cases/${ctx.caseA.id}/decision`],
      ['get', '/api/v1/staff/audit'],
    ];
    for (const agent of [ctx.studentA, root]) {
      for (const [method, path] of routes) {
        const res = await agent[method](path).send({});
        expect(res.status).toBe(403);
        expect(res.body.error.code).toBe('FORBIDDEN');
      }
    }
  });

  it("23. the B case never shows in A's queue, counts or search", async () => {
    const queue = await ctx.headA.get('/api/v1/staff/cases');
    expect(queue.body.cases.map((item) => item.id)).toEqual([ctx.caseA.id]);

    const counts = await ctx.headA.get('/api/v1/staff/cases/counts');
    expect(counts.body.counts.open).toBe(1);

    for (const q of [ctx.caseB.caseNumber, 'hr.pay@okaxis', '+919876543210', 'tcs-careers.in']) {
      const res = await ctx.headA.get(`/api/v1/staff/cases?q=${encodeURIComponent(q)}`);
      expect(res.body.cases.map((item) => item.id)).not.toContain(ctx.caseB.id);
    }
    const exact = await ctx.headA.get(`/api/v1/staff/cases?q=${encodeURIComponent(ctx.caseB.caseNumber)}`);
    expect(exact.body.total).toBe(0);
  });
});
