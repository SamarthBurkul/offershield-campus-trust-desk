'use strict';

const mongoose = require('mongoose');
const { useTestDatabase } = require('./helpers/db');
const { createTestApp } = require('./helpers/auth');
const { setupTwoColleges, createCaseAs } = require('./helpers/cases');
const { makePng, makePdf } = require('./fixtures/files');
const { runRetention, monthsBefore } = require('../scripts/lib/retention');
const { Case } = require('../src/models/Case');
const { CaseEvent } = require('../src/models/CaseEvent');
const { Evidence } = require('../src/models/Evidence');
const { AuditLog } = require('../src/models/AuditLog');

useTestDatabase();

let app;
beforeAll(() => {
  app = createTestApp();
});
beforeEach(() => {
  jest.spyOn(console, 'warn').mockImplementation(() => {});
});

const DAY = 24 * 3600 * 1000;
const decision = {
  type: 'inconclusive',
  basis: 'Could not confirm the company either way.',
  studentMessage: 'We could not confirm this offer. Do not pay anything.',
};

async function caseWithEvidence(student) {
  const created = await createCaseAs(student);
  const res = await student
    .post(`/api/v1/cases/${created.id}/evidence`)
    .attach('files', makePng(), { filename: 'chat.png', contentType: 'image/png' })
    .attach('files', makePdf(), { filename: 'offer.pdf', contentType: 'application/pdf' });
  if (res.status !== 201) throw new Error(`upload failed: ${res.status}`);
  return created.id;
}

/** Closed (decided) cases at different ages, and an old open case, all holding evidence. */
async function setup() {
  const ctx = await setupTwoColleges(app);
  const student = await ctx.as(ctx.alpha.student.email);
  const head = await ctx.as(ctx.alpha.head.email);
  const ids = { oldClosed: await caseWithEvidence(student), recentClosed: await caseWithEvidence(student), oldOpen: await caseWithEvidence(student) };
  for (const key of ['oldClosed', 'recentClosed']) {
    const res = await head.post(`/api/v1/staff/cases/${ids[key]}/decision`).send(decision);
    if (res.status !== 200) throw new Error(`decision failed: ${res.status}`);
  }
  const at = (days) => new Date(Date.now() - days * DAY);
  await Case.collection.updateOne({ _id: new mongoose.Types.ObjectId(ids.oldClosed) }, { $set: { 'decision.decidedAt': at(400), createdAt: at(410) } });
  await Case.collection.updateOne({ _id: new mongoose.Types.ObjectId(ids.recentClosed) }, { $set: { 'decision.decidedAt': at(30) } });
  await Case.collection.updateOne({ _id: new mongoose.Types.ObjectId(ids.oldOpen) }, { $set: { createdAt: at(500) } });
  return ids;
}

const evidenceOf = (id) => Evidence.countDocuments({ caseId: id });
const gridFsFiles = () => mongoose.connection.db.collection('evidence.files').countDocuments();

describe('ops:retention', () => {
  it('computes the cutoff in calendar months', () => {
    expect(monthsBefore(new Date('2026-11-12T00:00:00Z'), 12).toISOString()).toBe('2025-11-12T00:00:00.000Z');
  });

  it('dry run lists old closed cases and deletes nothing', async () => {
    const ids = await setup();
    const filesBefore = await gridFsFiles();

    const result = await runRetention({ months: 12 });

    expect(result.applied).toBe(false);
    expect(result.cases).toEqual([{ collegeId: expect.any(String), caseNumber: expect.stringMatching(/^OS-/), evidenceCount: 2 }]);
    expect(await evidenceOf(ids.oldClosed)).toBe(2);
    expect(await gridFsFiles()).toBe(filesBefore);
    expect(await CaseEvent.countDocuments({ type: 'evidence_purged' })).toBe(0);
  });

  it('--apply deletes evidence of old closed cases only, keeps the cases, and records events and audit entries', async () => {
    const ids = await setup();
    const filesBefore = await gridFsFiles();

    const result = await runRetention({ months: 12, apply: true });

    expect(result.cases).toHaveLength(1);
    expect(await evidenceOf(ids.oldClosed)).toBe(0);
    expect(await gridFsFiles()).toBe(filesBefore - 2);
    expect(await Case.exists({ _id: ids.oldClosed })).toBeTruthy();
    // Recently closed and open cases keep their evidence.
    expect(await evidenceOf(ids.recentClosed)).toBe(2);
    expect(await evidenceOf(ids.oldOpen)).toBe(2);

    const event = await CaseEvent.findOne({ type: 'evidence_purged' }).lean();
    expect(event).toMatchObject({ visibleToStudent: false, actorRole: 'system', metadata: { count: 2, retentionMonths: 12 } });
    expect(String(event.caseId)).toBe(ids.oldClosed);
    const entry = await AuditLog.findOne({ action: 'evidence.purged' }).lean();
    expect(String(entry.entityId)).toBe(ids.oldClosed);
    expect(entry.metadata).toEqual({ count: 2, retentionMonths: 12 });

    // Running again finds nothing left to purge.
    expect((await runRetention({ months: 12, apply: true })).cases).toEqual([]);
  });

  it('the purge event is staff-only: the student timeline does not show it', async () => {
    const ctx = await setupTwoColleges(app);
    const student = await ctx.as(ctx.alpha.student.email);
    const head = await ctx.as(ctx.alpha.head.email);
    const id = await caseWithEvidence(student);
    await head.post(`/api/v1/staff/cases/${id}/decision`).send(decision);
    await Case.collection.updateOne({ _id: new mongoose.Types.ObjectId(id) }, { $set: { 'decision.decidedAt': new Date(Date.now() - 400 * DAY) } });

    await runRetention({ months: 12, apply: true });

    const studentView = await student.get(`/api/v1/cases/${id}`);
    expect(JSON.stringify(studentView.body)).not.toContain('evidence_purged');
    const staffView = await head.get(`/api/v1/staff/cases/${id}`);
    expect(staffView.body.case.events.map((event) => event.type)).toContain('evidence_purged');
  });
});
