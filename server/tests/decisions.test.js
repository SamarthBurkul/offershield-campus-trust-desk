'use strict';

const { useTestDatabase } = require('./helpers/db');
const { createTestApp } = require('./helpers/auth');
const { setupDesk, fraudDecision, BASIS, createCaseAs } = require('./helpers/staffDesk');
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

const decide = (agent, body, id = ctx.caseA.id) => agent.post(`/api/v1/staff/cases/${id}/decision`).send(body);
const reopen = (agent, reason, id = ctx.caseA.id) => agent.post(`/api/v1/staff/cases/${id}/reopen`).send({ reason });

describe('decision authority', () => {
  it('13. officers get 403 on decision and reopen', async () => {
    const decision = await decide(ctx.officerA, fraudDecision());
    expect(decision.status).toBe(403);
    expect(decision.body.error.code).toBe('FORBIDDEN');

    await Case.updateOne({ _id: ctx.caseA.id }, { status: 'dismissed' });
    expect((await reopen(ctx.officerA, 'Student sent new evidence.')).status).toBe(403);
    expect((await Case.findById(ctx.caseA.id).lean()).status).toBe('dismissed');
  });
});

describe('confirmed_fraud', () => {
  it.each([
    ['basis under 30 characters', { basis: 'Too short a basis.' }],
    ['no checks', { checks: [] }],
    ['no confirmed indicators', { confirmedIndicators: [] }],
    ['missing studentMessage', { studentMessage: undefined }],
    ['unknown check', { checks: ['asked_a_friend'] }],
  ])('14a. rejects %s with 400 VALIDATION_ERROR', async (_label, overrides) => {
    const res = await decide(ctx.headA, fraudDecision(overrides));

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect((await Case.findById(ctx.caseA.id).lean()).status).toBe('submitted');
  });

  it('14b. rejects an indicator that is not on the case', async () => {
    const res = await decide(ctx.headA, fraudDecision({ confirmedIndicators: [{ type: 'upi', value: 'someone.else@ybl' }] }));

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('INDICATOR_NOT_ON_CASE');
    // Right value, wrong type is also not on the case.
    const wrongType = await decide(ctx.headA, fraudDecision({ confirmedIndicators: [{ type: 'email', value: 'hr.pay@okaxis' }] }));
    expect(wrongType.body.error.code).toBe('INDICATOR_NOT_ON_CASE');
  });

  it('14c. records the decision, a visible decision event and an audit entry without the basis', async () => {
    const res = await decide(
      ctx.headA,
      fraudDecision({ confirmedIndicators: [{ type: 'upi', value: 'HR.Pay@OkAxis' }, { type: 'phone', value: '98765 43210' }] }),
    );

    expect(res.status).toBe(200);
    expect(res.body.case.status).toBe('confirmed_fraud');
    expect(res.body.case.decision).toMatchObject({
      type: 'confirmed_fraud',
      basis: BASIS,
      checks: ['called_official_number', 'reviewed_student_evidence'],
      confirmedIndicators: [
        { type: 'upi', value: 'hr.pay@okaxis' },
        { type: 'phone', value: '+919876543210' },
      ],
      decidedBy: { id: String(ctx.alpha.head._id) },
    });

    const events = await CaseEvent.find({ caseId: ctx.caseA.id }).sort({ createdAt: 1 }).lean();
    expect(events.map((event) => [event.type, event.visibleToStudent])).toEqual([
      ['created', true],
      ['decision_recorded', true],
      ['status_changed', true],
    ]);
    expect(events[1].body).toBe(fraudDecision().studentMessage);

    const entry = await AuditLog.findOne({ action: 'case.decision' }).lean();
    expect(entry.metadata).toMatchObject({ type: 'confirmed_fraud', checks: ['called_official_number', 'reviewed_student_evidence'], confirmedIndicatorCount: 2 });
    expect(JSON.stringify(entry)).not.toContain(BASIS);
    expect(JSON.stringify(entry)).not.toContain(fraudDecision().studentMessage);
  });
});

describe('verified_genuine, inconclusive and dismissed', () => {
  const genuine = (overrides) => ({
    type: 'verified_genuine',
    basis: 'Confirmed with the company careers page and the official HR email domain.',
    checks: ['checked_official_careers_page'],
    studentMessage: 'This offer is genuine. You may proceed through official channels.',
    ...overrides,
  });

  it('15. verified_genuine accepts case domains only', async () => {
    const bad = await decide(ctx.headA, genuine({ verifiedDomains: ['not-on-case.com'] }));
    expect(bad.status).toBe(400);
    expect(bad.body.error.code).toBe('INDICATOR_NOT_ON_CASE');

    const good = await decide(ctx.headA, genuine({ verifiedDomains: ['WWW.TCS-Careers.in'] }));
    expect(good.status).toBe(200);
    expect(good.body.case.decision.verifiedDomains).toEqual(['tcs-careers.in']);
    expect(good.body.case.status).toBe('verified_genuine');
  });

  it('16a. inconclusive needs only a shorter basis and the student message', async () => {
    const res = await decide(ctx.headA, { type: 'inconclusive', basis: 'Company did not respond.', studentMessage: 'We could not verify this offer. Be careful.' });

    expect(res.status).toBe(200);
    expect(res.body.case.status).toBe('inconclusive');
  });

  it('16b. dismissed as duplicate requires a different case of this college', async () => {
    const base = { type: 'dismissed', basis: 'Same offer already reported.', studentMessage: 'This was already reported; see your other request.' };
    const other = await createCaseAs(ctx.studentA);

    const noReason = await decide(ctx.headA, base);
    expect(noReason.status).toBe(400);
    const noCase = await decide(ctx.headA, { ...base, dismissReason: 'duplicate' });
    expect(noCase.status).toBe(400);
    const self = await decide(ctx.headA, { ...base, dismissReason: 'duplicate', duplicateOfCaseId: ctx.caseA.id });
    expect(self.status).toBe(400);
    const otherCollege = await decide(ctx.headA, { ...base, dismissReason: 'duplicate', duplicateOfCaseId: ctx.caseB.id });
    expect(otherCollege.status).toBe(404);
    const missing = await decide(ctx.headA, { ...base, dismissReason: 'duplicate', duplicateOfCaseId: '507f1f77bcf86cd799439011' });
    expect(missing.status).toBe(404);
    expect((await Case.findById(ctx.caseA.id).lean()).status).toBe('submitted');

    const ok = await decide(ctx.headA, { ...base, dismissReason: 'duplicate', duplicateOfCaseId: other.id });
    expect(ok.status).toBe(200);
    expect(ok.body.case.decision).toMatchObject({ dismissReason: 'duplicate', duplicateOfCaseId: other.id });

    const notAnOffer = await decide(
      ctx.headA,
      { ...base, dismissReason: 'not_an_opportunity', basis: 'It is a newsletter, not an offer.' },
      other.id,
    );
    expect(notAnOffer.status).toBe(200);
  });
});

describe('student view, concurrency and reopen', () => {
  it('17. the student sees only { type, decidedAt, message }', async () => {
    await decide(ctx.headA, fraudDecision());

    const res = await ctx.studentA.get(`/api/v1/cases/${ctx.caseA.id}`);

    expect(res.body.case.status).toBe('confirmed_fraud');
    expect(res.body.case.decision).toEqual({ type: 'confirmed_fraud', decidedAt: expect.any(String), message: fraudDecision().studentMessage });
    expect(res.text).not.toContain(BASIS);
    for (const hidden of ['called_official_number', 'reviewed_student_evidence', 'decidedBy', 'confirmedIndicators', 'checks', 'basis', String(ctx.alpha.head._id)]) {
      expect(res.text).not.toContain(hidden);
    }
    expect(res.body.events.find((event) => event.type === 'decision_recorded').body).toBe(fraudDecision().studentMessage);
  });

  it('18. two concurrent decisions: exactly one succeeds', async () => {
    const [a, b] = await Promise.all([
      decide(ctx.headA, fraudDecision()),
      decide(ctx.headA, { type: 'inconclusive', basis: 'Could not reach anyone.', studentMessage: 'We could not verify this offer.' }),
    ]);

    expect([a.status, b.status].sort()).toEqual([200, 409]);
    expect([a, b].find((res) => res.status === 409).body.error.code).toBe('INVALID_TRANSITION');
    expect(await CaseEvent.countDocuments({ caseId: ctx.caseA.id, type: 'decision_recorded' })).toBe(1);
  });

  it('19. a decision on a closed case is 409', async () => {
    await decide(ctx.headA, fraudDecision());
    const again = await decide(ctx.headA, fraudDecision());

    expect(again.status).toBe(409);
    expect((await Case.findById(ctx.caseA.id).lean()).decision.type).toBe('confirmed_fraud');
  });

  it('20. reopen moves the decision to history, hides the reason from the student and allows a new decision', async () => {
    const reason = 'REOPEN-REASON: student found the company on the official MCA site.';
    expect((await reopen(ctx.headA, reason)).status).toBe(409);

    await decide(ctx.headA, fraudDecision());
    const res = await reopen(ctx.headA, reason);

    expect(res.status).toBe(200);
    expect(res.body.case.status).toBe('under_review');
    expect(res.body.case.decision).toBeNull();
    expect(res.body.case.decisionHistory).toEqual([
      expect.objectContaining({ type: 'confirmed_fraud', basis: BASIS, reopenReason: reason, reopenedBy: expect.objectContaining({ id: String(ctx.alpha.head._id) }) }),
    ]);

    const studentView = await ctx.studentA.get(`/api/v1/cases/${ctx.caseA.id}`);
    expect(studentView.body.case.decision).toBeNull();
    expect(studentView.text).not.toContain('REOPEN-REASON');
    expect(studentView.body.events.at(-1)).toMatchObject({ type: 'reopened', body: 'Your request has been reopened for further review.' });

    const second = await decide(ctx.headA, { type: 'inconclusive', basis: 'New evidence is ambiguous.', studentMessage: 'We could not verify this offer either way.' });
    expect(second.status).toBe(200);
    expect(second.body.case.decisionHistory).toHaveLength(1);
    expect(second.body.case.decision.type).toBe('inconclusive');
  });
});
