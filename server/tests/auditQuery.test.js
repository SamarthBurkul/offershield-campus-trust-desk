'use strict';

const { useTestDatabase } = require('./helpers/db');
const { createTestApp } = require('./helpers/auth');
const { setupDesk, fraudDecision } = require('./helpers/staffDesk');
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

async function runFullCaseLifecycle() {
  const base = `/api/v1/staff/cases/${ctx.caseA.id}`;
  const steps = [
    [ctx.officerA.patch(`${base}/assign`).send({ assigneeId: String(ctx.alpha.officer._id) }), 200],
    [ctx.officerA.post(`${base}/info-request`).send({ message: 'Please share the original message screenshot.' }), 201],
  ];
  for (const [req, status] of steps) expect((await req).status).toBe(status);
  expect((await ctx.officerA.patch(`${base}/status`).send({ status: 'under_review' })).status).toBe(200);
  expect((await ctx.officerA.post(`${base}/messages`).send({ body: 'Thanks, reviewing now.' })).status).toBe(201);
  expect((await ctx.officerA.post(`${base}/notes`).send({ body: 'Internal: matches pattern seen last month.' })).status).toBe(201);
  expect((await ctx.officerA.post(`${base}/recommendation`).send({ type: 'confirmed_fraud', basis: 'Registration fee via UPI.' })).status).toBe(200);
  expect((await ctx.headA.post(`${base}/decision`).send(fraudDecision())).status).toBe(200);
  expect((await ctx.headA.post(`${base}/reopen`).send({ reason: 'Student shared new information.' })).status).toBe(200);
}

describe('audit trail of the staff desk', () => {
  it('24. records every case action with the right college, actor and entity', async () => {
    await runFullCaseLifecycle();

    const expected = {
      'case.assign': 'placement_officer',
      'case.info_request': 'placement_officer',
      'case.status_change': 'placement_officer',
      'case.staff_message': 'placement_officer',
      'case.note_add': 'placement_officer',
      'case.recommend': 'placement_officer',
      'case.decision': 'tpo_head',
      'case.reopen': 'tpo_head',
    };
    for (const [action, role] of Object.entries(expected)) {
      const entry = await AuditLog.findOne({ action }).lean();
      expect(entry).toBeTruthy();
      expect(String(entry.collegeId)).toBe(String(ctx.alpha.college._id));
      expect(String(entry.entityId)).toBe(ctx.caseA.id);
      expect(entry.entityType).toBe('case');
      expect(entry.actorRole).toBe(role);
      expect(String(entry.actorId)).toBe(String(role === 'tpo_head' ? ctx.alpha.head._id : ctx.alpha.officer._id));
    }
    const all = JSON.stringify(await AuditLog.find({ action: /^case\./ }).lean());
    expect(all).not.toContain('Internal: matches pattern');
    expect(all).not.toContain('Student shared new information');
  });

  it('25. GET /staff/audit: head only, college-scoped, filterable, newest first', async () => {
    await runFullCaseLifecycle();
    // Activity in college B must never appear for college A.
    await ctx.headB.post(`/api/v1/staff/cases/${ctx.caseB.id}/notes`).send({ body: 'B college note' });

    const res = await ctx.headA.get('/api/v1/staff/audit?limit=100');
    expect(res.status).toBe(200);
    const actions = res.body.entries.map((entry) => entry.action);
    expect(actions).toEqual(expect.arrayContaining(['case.decision', 'case.reopen', 'case.create', 'case.note_add']));
    expect(res.body.entries.every((entry) => entry.entity.id !== ctx.caseB.id)).toBe(true);
    expect(res.body.total).toBe(res.body.entries.length);
    const times = res.body.entries.map((entry) => entry.createdAt);
    expect([...times].sort().reverse()).toEqual(times);
    const decisionEntry = res.body.entries.find((entry) => entry.action === 'case.decision');
    expect(decisionEntry.actor).toEqual({ id: String(ctx.alpha.head._id), name: expect.any(String), role: 'tpo_head' });

    const byAction = await ctx.headA.get('/api/v1/staff/audit?action=case.decision');
    expect(byAction.body.entries.map((entry) => entry.action)).toEqual(['case.decision']);
    const byActor = await ctx.headA.get(`/api/v1/staff/audit?actorId=${ctx.alpha.officer._id}`);
    expect(byActor.body.entries.every((entry) => entry.actor.id === String(ctx.alpha.officer._id))).toBe(true);
    expect(byActor.body.entries.length).toBeGreaterThanOrEqual(6);
    const byEntity = await ctx.headA.get(`/api/v1/staff/audit?entityType=case&entityId=${ctx.caseA.id}`);
    expect(byEntity.body.entries.every((entry) => entry.entity.id === ctx.caseA.id)).toBe(true);
    const future = await ctx.headA.get('/api/v1/staff/audit?from=2999-01-01');
    expect(future.body.entries).toEqual([]);
    const paged = await ctx.headA.get('/api/v1/staff/audit?limit=2&page=2');
    expect(paged.body.entries).toHaveLength(2);
    expect((await ctx.headA.get('/api/v1/staff/audit?limit=101')).status).toBe(400);

    const bView = await ctx.headB.get('/api/v1/staff/audit?limit=100');
    expect(bView.body.entries.every((entry) => entry.entity.id !== ctx.caseA.id)).toBe(true);
    expect(bView.body.entries.map((entry) => entry.action)).toContain('case.note_add');

    const officer = await ctx.officerA.get('/api/v1/staff/audit');
    expect(officer.status).toBe(403);
  });
});
