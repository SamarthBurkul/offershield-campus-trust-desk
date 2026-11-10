'use strict';

const { useTestDatabase } = require('./helpers/db');
const { createTestApp } = require('./helpers/auth');
const { setupDesk, createCaseAs } = require('./helpers/staffDesk');
const { Case } = require('../src/models/Case');
const { CaseEvent } = require('../src/models/CaseEvent');
const { Note } = require('../src/models/Note');
const { AuditLog } = require('../src/models/AuditLog');
const { makePng } = require('./fixtures/files');

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

const queue = (agent, query = '') => agent.get(`/api/v1/staff/cases${query}`);
const numbers = (res) => res.body.cases.map((item) => item.caseNumber).sort();

describe('GET /staff/cases (queue)', () => {
  it('3. lists only this college and supports every filter and pagination', async () => {
    const second = await createCaseAs(ctx.studentA, { channel: 'email', claimedCompany: 'Second Co' });
    const third = await createCaseAs(ctx.studentA, { claimedCompany: 'Third Co' });
    await Case.updateOne({ _id: second.id }, { priority: 'high', assigneeId: ctx.alpha.officer._id, status: 'under_review' });
    // createdAt is immutable through mongoose, so backdate it on the raw collection.
    await Case.collection.updateOne(
      { _id: new (require('mongoose').Types.ObjectId)(third.id) },
      { $set: { status: 'dismissed', createdAt: new Date('2025-01-15T00:00:00Z') } },
    );

    const all = await queue(ctx.officerA);
    expect(all.status).toBe(200);
    expect(numbers(all)).toEqual(['OS-DEMO-ALPHA-0001', 'OS-DEMO-ALPHA-0002', 'OS-DEMO-ALPHA-0003']);
    expect(all.body.total).toBe(3);
    const row = all.body.cases.find((item) => item.id === ctx.caseA.id);
    expect(row).toMatchObject({
      claimedCompany: 'Tata Consultancy Services',
      roleTitle: 'Software Intern',
      channel: 'whatsapp',
      status: 'submitted',
      priority: 'normal',
      student: { name: expect.any(String), year: 2, branch: 'COMP' },
      assignee: null,
      evidenceCount: 0,
      isStale: false,
    });

    const by = async (query) => numbers(await queue(ctx.officerA, query));
    expect(await by('?status=submitted')).toEqual(['OS-DEMO-ALPHA-0001']);
    expect(await by('?status=open')).toEqual(['OS-DEMO-ALPHA-0001', 'OS-DEMO-ALPHA-0002']);
    expect(await by('?status=closed')).toEqual(['OS-DEMO-ALPHA-0003']);
    expect(await by('?priority=high')).toEqual(['OS-DEMO-ALPHA-0002']);
    expect(await by('?assignee=me')).toEqual(['OS-DEMO-ALPHA-0002']);
    expect(await by('?assignee=unassigned')).toEqual(['OS-DEMO-ALPHA-0001', 'OS-DEMO-ALPHA-0003']);
    expect(await by(`?assignee=${ctx.alpha.officer._id}`)).toEqual(['OS-DEMO-ALPHA-0002']);
    expect(await by('?channel=email')).toEqual(['OS-DEMO-ALPHA-0002']);
    expect(await by('?from=2025-01-01&to=2025-02-01')).toEqual(['OS-DEMO-ALPHA-0003']);
    expect(await by('?from=2026-01-01')).toEqual(['OS-DEMO-ALPHA-0001', 'OS-DEMO-ALPHA-0002']);

    const page1 = await queue(ctx.officerA, '?limit=2&page=1&sort=created');
    const page2 = await queue(ctx.officerA, '?limit=2&page=2&sort=created');
    expect(page1.body.cases).toHaveLength(2);
    expect(page2.body.cases).toHaveLength(1);
    expect(new Set([...numbers(page1), ...numbers(page2)]).size).toBe(3);
    expect((await queue(ctx.officerA, '?priority=high&sort=priority')).status).toBe(200);
    expect((await queue(ctx.officerA, '?limit=51')).status).toBe(400);
    expect((await queue(ctx.officerA, '?status=final')).status).toBe(400);
    expect((await queue(ctx.officerA, '?collegeId=x')).status).toBe(400);
  });

  it('4. searches by case number, company substring, escaped regex, phone, UPI and domain', async () => {
    await createCaseAs(ctx.studentA, {
      claimedCompany: 'Infosys (Pune)',
      messageText: 'Pay to other.desk@ybl, visit quick-hire.online and call 9123456789',
      links: [],
      contacts: { emails: [], phones: [], upiIds: [] },
    });
    const search = async (q) => numbers(await queue(ctx.officerA, `?q=${encodeURIComponent(q)}`));

    expect(await search('os-demo-alpha-0001')).toEqual(['OS-DEMO-ALPHA-0001']);
    expect(await search('consultancy')).toEqual(['OS-DEMO-ALPHA-0001']);
    expect(await search('(Pune)')).toEqual(['OS-DEMO-ALPHA-0002']);
    expect(await search('.*')).toEqual([]);
    expect(await search('[a-z]+')).toEqual([]);
    expect(await search('98765 43210')).toEqual(['OS-DEMO-ALPHA-0001']);
    expect(await search('+91-91234-56789')).toEqual(['OS-DEMO-ALPHA-0002']);
    expect(await search('HR.PAY@okaxis')).toEqual(['OS-DEMO-ALPHA-0001']);
    expect(await search('WWW.Quick-Hire.ONLINE')).toEqual(['OS-DEMO-ALPHA-0002']);
    expect(await search('www.TCS-careers.in')).toEqual(['OS-DEMO-ALPHA-0001']);
  });

  it('5. counts are correct and isStale applies only to old open cases', async () => {
    const stale = await createCaseAs(ctx.studentA);
    const closedOld = await createCaseAs(ctx.studentA);
    const old = new Date(Date.now() - 4 * 86_400_000);
    await Case.updateOne({ _id: stale.id }, { lastActivityAt: old, status: 'awaiting_student', assigneeId: ctx.alpha.officer._id });
    await Case.updateOne({ _id: closedOld.id }, { lastActivityAt: old, status: 'inconclusive' });

    const counts = await ctx.officerA.get('/api/v1/staff/cases/counts');
    expect(counts.body.counts).toEqual({
      submitted: 1,
      under_review: 0,
      awaiting_student: 1,
      open: 2,
      closed: 1,
      unassignedOpen: 1,
      staleOpen: 1,
    });

    const rows = (await queue(ctx.officerA)).body.cases;
    const staleOf = (id) => rows.find((item) => item.id === id).isStale;
    expect(staleOf(stale.id)).toBe(true);
    expect(staleOf(closedOld.id)).toBe(false);
    expect(staleOf(ctx.caseA.id)).toBe(false);

    const strictApp = createTestApp({ CASE_STALE_DAYS: '5' });
    const { loginAgent } = require('./helpers/auth');
    const officer = await loginAgent(strictApp, 'officer@demo-alpha.test.edu', 'TestPassw0rd-1');
    expect((await officer.get('/api/v1/staff/cases/counts')).body.counts.staleOpen).toBe(0);
  });
});

describe('GET /staff/cases/:id', () => {
  it('6. includes notes, internal events, recommendation and decision, and never gridFsId', async () => {
    await ctx.studentA.post(`/api/v1/cases/${ctx.caseA.id}/evidence`).attach('files', makePng(), { filename: 'chat.png', contentType: 'image/png' });
    await ctx.officerA.post(`/api/v1/staff/cases/${ctx.caseA.id}/notes`).send({ body: 'Checked LinkedIn: no such recruiter.' });
    await ctx.officerA.post(`/api/v1/staff/cases/${ctx.caseA.id}/recommendation`).send({ type: 'confirmed_fraud', basis: 'UPI collection for registration fee.' });

    const res = await ctx.headA.get(`/api/v1/staff/cases/${ctx.caseA.id}`);

    expect(res.status).toBe(200);
    const view = res.body.case;
    expect(view.notes).toEqual([expect.objectContaining({ body: 'Checked LinkedIn: no such recruiter.', author: expect.objectContaining({ role: 'placement_officer' }) })]);
    expect(view.recommendation).toMatchObject({ type: 'confirmed_fraud', basis: 'UPI collection for registration fee.', by: { name: expect.any(String) } });
    expect(view.decision).toBeNull();
    expect(view.decisionHistory).toEqual([]);
    expect(view.events.map((event) => [event.type, event.visibleToStudent])).toEqual([
      ['created', true],
      ['evidence_added', true],
      ['recommendation_made', false],
    ]);
    expect(view.student).toMatchObject({ email: 'student@demo-alpha.test.edu', year: 2, branch: 'COMP' });
    expect(view.priority).toBe('normal');
    expect(view.evidence).toHaveLength(1);
    expect(view.evidence[0]).toHaveProperty('sha256');
    expect(res.text).not.toContain('gridFsId');
  });
});

describe('PATCH /staff/cases/:id/assign', () => {
  const assign = (agent, assigneeId, id = ctx.caseA.id) => agent.patch(`/api/v1/staff/cases/${id}/assign`).send({ assigneeId });

  it('7a. the head assigns an officer; submitted moves to under_review with events', async () => {
    const res = await assign(ctx.headA, String(ctx.alpha.officer._id));

    expect(res.status).toBe(200);
    expect(res.body.case).toMatchObject({ status: 'under_review', assignee: { id: String(ctx.alpha.officer._id) } });
    const events = await CaseEvent.find({ caseId: ctx.caseA.id }).sort({ createdAt: 1 }).lean();
    expect(events.map((event) => [event.type, event.visibleToStudent])).toEqual([
      ['created', true],
      ['assigned', false],
      ['status_changed', true],
    ]);
    // Reassigning an under_review case keeps the status.
    const again = await assign(ctx.headA, String(ctx.alpha.officer2._id));
    expect(again.body.case).toMatchObject({ status: 'under_review', assignee: { id: String(ctx.alpha.officer2._id) } });
  });

  it('7b. officers may only assign or release themselves', async () => {
    expect((await assign(ctx.officerA, String(ctx.alpha.officer2._id))).status).toBe(403);
    const self = await assign(ctx.officerA, String(ctx.alpha.officer._id));
    expect(self.status).toBe(200);
    expect(self.body.case.assignee.id).toBe(String(ctx.alpha.officer._id));
    expect((await assign(ctx.officerA, null)).status).toBe(200);

    await assign(ctx.headA, String(ctx.alpha.officer2._id));
    expect((await assign(ctx.officerA, null)).status).toBe(403);
  });

  it.each([
    ['a student', (c) => c.alpha.student._id],
    ['a disabled officer', (c) => c.alpha.disabledOfficer._id],
    ['an officer of another college', (c) => c.beta.officer._id],
    ['an unknown id', () => '507f1f77bcf86cd799439011'],
  ])('7c. assigning %s returns 400 INVALID_ASSIGNEE', async (_label, pick) => {
    const res = await assign(ctx.headA, String(pick(ctx)));

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('INVALID_ASSIGNEE');
    expect((await Case.findById(ctx.caseA.id).lean()).assigneeId).toBeNull();
  });
});

describe('status, info requests and messages', () => {
  it('8. the status endpoint allows awaiting_student -> under_review and rejects final statuses', async () => {
    await Case.updateOne({ _id: ctx.caseA.id }, { status: 'awaiting_student' });
    const ok = await ctx.officerA.patch(`/api/v1/staff/cases/${ctx.caseA.id}/status`).send({ status: 'under_review' });
    expect(ok.status).toBe(200);
    expect(ok.body.case.status).toBe('under_review');

    const again = await ctx.officerA.patch(`/api/v1/staff/cases/${ctx.caseA.id}/status`).send({ status: 'under_review' });
    expect(again.status).toBe(409);
    expect(again.body.error.code).toBe('INVALID_TRANSITION');

    for (const status of ['confirmed_fraud', 'verified_genuine', 'dismissed', 'awaiting_student']) {
      const res = await ctx.headA.patch(`/api/v1/staff/cases/${ctx.caseA.id}/status`).send({ status });
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    }
    expect((await Case.findById(ctx.caseA.id).lean()).status).toBe('under_review');
  });

  it('9. an info request moves to awaiting_student, the student sees it and a reply moves back', async () => {
    const message = 'Please upload the full chat screenshot including the phone number.';
    const res = await ctx.officerA.post(`/api/v1/staff/cases/${ctx.caseA.id}/info-request`).send({ message });
    expect(res.status).toBe(201);
    expect(res.body.case.status).toBe('awaiting_student');

    const studentView = await ctx.studentA.get(`/api/v1/cases/${ctx.caseA.id}`);
    expect(studentView.body.case.status).toBe('awaiting_student');
    expect(studentView.body.events.at(-1)).toMatchObject({ type: 'info_requested', actor: 'placement_cell', body: message });

    const reply = await ctx.studentA.post(`/api/v1/cases/${ctx.caseA.id}/messages`).send({ body: 'Uploaded it now.' });
    expect(reply.body.case.status).toBe('under_review');

    await Case.updateOne({ _id: ctx.caseA.id }, { status: 'dismissed' });
    const closed = await ctx.officerA.post(`/api/v1/staff/cases/${ctx.caseA.id}/info-request`).send({ message });
    expect(closed.status).toBe(409);
    expect(closed.body.error.code).toBe('CASE_CLOSED');
  });

  it('10. a staff message is visible to the student and refused on closed cases', async () => {
    const res = await ctx.headA.post(`/api/v1/staff/cases/${ctx.caseA.id}/messages`).send({ body: 'We are checking with the company.' });
    expect(res.status).toBe(201);
    expect(res.body.case.status).toBe('submitted');

    const studentView = await ctx.studentA.get(`/api/v1/cases/${ctx.caseA.id}`);
    expect(studentView.body.events.at(-1)).toMatchObject({ type: 'staff_message', body: 'We are checking with the company.' });

    await Case.updateOne({ _id: ctx.caseA.id }, { status: 'verified_genuine' });
    const closed = await ctx.headA.post(`/api/v1/staff/cases/${ctx.caseA.id}/messages`).send({ body: 'More info' });
    expect(closed.status).toBe(409);
  });
});

describe('notes and recommendations', () => {
  it('11. notes are staff-only, unaudited in content and append-only', async () => {
    const text = 'INTERNAL: student seems to have paid already, check bank statement.';
    const res = await ctx.officerA.post(`/api/v1/staff/cases/${ctx.caseA.id}/notes`).send({ body: text });
    expect(res.status).toBe(201);
    expect(res.body.case.notes.map((note) => note.body)).toEqual([text]);

    const studentView = await ctx.studentA.get(`/api/v1/cases/${ctx.caseA.id}`);
    expect(JSON.stringify(studentView.body)).not.toContain(text);
    expect(JSON.stringify(studentView.body)).not.toContain('INTERNAL');

    const entry = await AuditLog.findOne({ action: 'case.note_add' }).lean();
    expect(entry).toBeTruthy();
    expect(JSON.stringify(entry)).not.toContain(text);

    // Notes are allowed on closed cases too.
    await Case.updateOne({ _id: ctx.caseA.id }, { status: 'dismissed' });
    expect((await ctx.headA.post(`/api/v1/staff/cases/${ctx.caseA.id}/notes`).send({ body: 'Closed follow-up' })).status).toBe(201);

    const note = await Note.findOne({ body: text });
    await expect(Note.updateOne({ _id: note._id }, { body: 'edited' })).rejects.toThrow(/append-only/);
    await expect(Note.deleteOne({ _id: note._id })).rejects.toThrow(/append-only/);
    await expect(Note.deleteMany({})).rejects.toThrow(/append-only/);
    note.body = 'edited';
    await expect(note.save()).rejects.toThrow(/append-only/);
  });

  it('12. officers can recommend; the student never sees the recommendation basis', async () => {
    const basis = 'RECOMMEND-BASIS: UPI collect request matches known scam pattern.';
    const res = await ctx.officerA.post(`/api/v1/staff/cases/${ctx.caseA.id}/recommendation`).send({ type: 'confirmed_fraud', basis });

    expect(res.status).toBe(200);
    expect(res.body.case.recommendation).toMatchObject({ type: 'confirmed_fraud', basis });
    const replaced = await ctx.headA.post(`/api/v1/staff/cases/${ctx.caseA.id}/recommendation`).send({ type: 'inconclusive', basis: 'Could not reach the company.' });
    expect(replaced.body.case.recommendation.type).toBe('inconclusive');

    const studentView = await ctx.studentA.get(`/api/v1/cases/${ctx.caseA.id}`);
    expect(studentView.text).not.toContain('RECOMMEND-BASIS');
    expect(studentView.text).not.toContain('Could not reach the company');
    expect(studentView.body.case).not.toHaveProperty('recommendation');
    expect(studentView.body.events.map((event) => event.type)).not.toContain('recommendation_made');

    await Case.updateOne({ _id: ctx.caseA.id }, { status: 'dismissed' });
    expect((await ctx.officerA.post(`/api/v1/staff/cases/${ctx.caseA.id}/recommendation`).send({ type: 'dismissed', basis: 'Duplicate of another case.' })).status).toBe(409);
  });
});
