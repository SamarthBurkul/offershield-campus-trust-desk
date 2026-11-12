'use strict';

const mongoose = require('mongoose');
const { useTestDatabase } = require('./helpers/db');
const { createTestConfig } = require('./helpers/auth');
const { createCollegeWithMembers } = require('./helpers/factories');
const { loadConfig } = require('../src/config/env');
const { seedShowcase, SHOWCASE } = require('../scripts/lib/showcase');
const { resetDemoColleges } = require('../scripts/lib/demoReset');
const { seedDemoColleges } = require('../scripts/lib/demoColleges');
const { assertDemoSeedAllowed } = require('../scripts/lib/seedGuard');
const { College } = require('../src/models/College');
const { User } = require('../src/models/User');
const { Case } = require('../src/models/Case');
const { Evidence } = require('../src/models/Evidence');
const { FraudIndicator } = require('../src/models/FraudIndicator');
const { Recruiter } = require('../src/models/Recruiter');
const { Advisory } = require('../src/models/Advisory');
const { Acknowledgement } = require('../src/models/Acknowledgement');
const { LookupEvent } = require('../src/models/LookupEvent');
const { AuditLog } = require('../src/models/AuditLog');
const { Counter } = require('../src/models/Counter');

useTestDatabase();
jest.setTimeout(180_000);

// Test-only demo password.
const DEMO_PASSWORD = 'ShowcasePassw0rd-1';
const DAY = 24 * 3600 * 1000;
const config = createTestConfig();
const seed = () => seedShowcase({ demoPassword: DEMO_PASSWORD, config });

async function countBy(Model, field, filter = {}) {
  const rows = await Model.aggregate([{ $match: filter }, { $group: { _id: `$${field}`, n: { $sum: 1 } } }]);
  return Object.fromEntries(rows.map((row) => [row._id, row.n]));
}

describe('seed:showcase', () => {
  it('creates a realistic, internally consistent demo college, and is idempotent', async () => {
    const result = await seed();
    expect(result.created).toBe(true);

    const college = await College.findOne({ code: 'demo-campus' }).lean();
    expect(college).toMatchObject({ name: 'Demo Institute of Technology', isDemo: true, studentVerification: 'email_domain', emailDomains: ['demo-campus.edu'] });

    expect(await countBy(User, 'role', { collegeId: college._id })).toEqual({ tpo_head: 1, placement_officer: 2, student: 24 });
    const students = await User.find({ collegeId: college._id, role: 'student' }).lean();
    expect(new Set(students.map((s) => s.branch)).size).toBe(4);
    expect([...new Set(students.map((s) => s.year))].sort()).toEqual([2, 3, 4]);

    // Every status, with the required decision mix.
    expect(await countBy(Case, 'status', { collegeId: college._id })).toEqual({
      confirmed_fraud: 3,
      verified_genuine: 1,
      inconclusive: 1,
      dismissed: 1,
      under_review: 3,
      awaiting_student: 2,
      submitted: 3,
    });
    const cases = await Case.find({ collegeId: college._id }).lean();
    expect(cases.filter((c) => c.decision?.dismissReason === 'duplicate')).toHaveLength(1);
    const reopened = cases.filter((c) => c.decisionHistory.length > 0);
    expect(reopened).toHaveLength(1);
    expect(reopened[0]).toMatchObject({ status: 'under_review', decision: null });

    // Two related clusters: a shared UPI id and near-duplicate text.
    const withReason = (reason) => cases.filter((c) => c.related.some((r) => r.reasons.includes(reason)));
    expect(withReason('shared_indicator').length).toBeGreaterThanOrEqual(3);
    expect(withReason('similar_text').length).toBeGreaterThanOrEqual(3);

    // Confirmed indicators come only from the fraud decisions and are clearly fictional.
    const indicators = await FraudIndicator.find({ collegeId: college._id }).lean();
    expect(indicators.length).toBeGreaterThanOrEqual(3);
    for (const { type, value, status } of indicators) {
      expect(status).toBe('active');
      if (type === 'upi') expect(value).toContain('demo');
      else expect(value).toMatch(/-demo\.xyz$/);
    }
    const allContacts = cases.flatMap((c) => [...c.contacts.upiIds, ...c.contacts.phones, ...c.contacts.emails]);
    for (const contact of allContacts) {
      expect(contact.includes('demo') || /^\+91 90000 0000\d$/.test(contact) || /@(infosys|tcs|accenture)\.com$/.test(contact)).toBe(true);
    }

    expect(await countBy(Recruiter, 'status', { collegeId: college._id })).toEqual({ verified: 4, pending_approval: 1 });
    const expired = await Recruiter.find({ collegeId: college._id, 'verification.expiresAt': { $lt: new Date() } }).lean();
    expect(expired.map((r) => r.companyName)).toEqual(['Capgemini']);

    const advisories = await Advisory.find({ collegeId: college._id }).lean();
    expect(advisories.map((a) => a.status).sort()).toEqual(['draft', 'published']);
    const published = advisories.find((a) => a.status === 'published');
    expect(published.target.years).toEqual([3, 4]);
    expect(await Acknowledgement.countDocuments({ advisoryId: published._id })).toBe(SHOWCASE.ADVISORIES.published.acknowledgedBy.length);

    const evidence = await Evidence.countDocuments({ collegeId: college._id });
    expect(evidence).toBeGreaterThanOrEqual(5);
    expect(await mongoose.connection.db.collection('evidence.files').countDocuments({ 'metadata.collegeId': String(college._id) })).toBe(evidence);

    expect(Object.keys(await countBy(LookupEvent, 'resultStatus', { collegeId: college._id })).sort()).toEqual(
      ['confirmed_fraud', 'lookalike_warning', 'not_reviewed', 'verified', 'verified_expired'],
    );

    // Activity is spread over the last six weeks, never in the future.
    const created = cases.map((c) => c.createdAt.getTime());
    expect(Math.min(...created)).toBeLessThan(Date.now() - 35 * DAY);
    expect(Math.max(...created)).toBeLessThanOrEqual(Date.now());
    for (const c of cases.filter((item) => item.decision)) expect(c.decision.decidedAt.getTime()).toBeGreaterThan(c.createdAt.getTime());

    // A second run without --reset changes nothing.
    const counts = { cases: await Case.countDocuments(), users: await User.countDocuments(), audit: await AuditLog.countDocuments() };
    expect((await seed()).created).toBe(false);
    expect({ cases: await Case.countDocuments(), users: await User.countDocuments(), audit: await AuditLog.countDocuments() }).toEqual(counts);
  });

  it('--reset removes and recreates only isDemo colleges; a real college and its data are untouched', async () => {
    const real = await createCollegeWithMembers('real-college');
    await AuditLog.create({ collegeId: real.college._id, action: 'college.create', entityType: 'college', entityId: real.college._id });
    await Counter.create({ collegeId: real.college._id, key: 'case', seq: 7 });
    await seedDemoColleges(DEMO_PASSWORD, { log: () => {} });
    const first = await seed();
    const realBefore = {
      users: await User.countDocuments({ collegeId: real.college._id }),
      audit: await AuditLog.countDocuments({ collegeId: real.college._id }),
      counter: (await Counter.findOne({ collegeId: real.college._id }).lean()).seq,
    };

    const { colleges } = await resetDemoColleges();
    expect(colleges.sort()).toEqual(['demo-alpha', 'demo-beta', 'demo-campus']);
    const demoIds = [first.college._id];
    for (const Model of [User, Case, Evidence, FraudIndicator, Recruiter, Advisory, AuditLog, Counter, LookupEvent]) {
      expect(await Model.countDocuments({ collegeId: { $in: demoIds } })).toBe(0);
    }
    expect(await mongoose.connection.db.collection('evidence.files').countDocuments()).toBe(0);
    expect(await mongoose.connection.db.collection('evidence.chunks').countDocuments()).toBe(0);

    const second = await seed();
    expect(second.created).toBe(true);
    expect(String(second.college._id)).not.toBe(String(first.college._id));
    expect(await Case.countDocuments({ collegeId: second.college._id })).toBe(14);

    expect(await College.exists({ _id: real.college._id, isDemo: false })).toBeTruthy();
    expect({
      users: await User.countDocuments({ collegeId: real.college._id }),
      audit: await AuditLog.countDocuments({ collegeId: real.college._id }),
      counter: (await Counter.findOne({ collegeId: real.college._id }).lean()).seq,
    }).toEqual(realBefore);
  });

  it('seed:demo marks existing demo-alpha/beta colleges as isDemo', async () => {
    await College.create({ name: 'Old alpha', code: 'demo-alpha', emailDomains: ['alpha.demo.edu'], studentJoinCodeHash: 'x' });

    await seedDemoColleges(DEMO_PASSWORD, { log: () => {} });

    expect(await College.countDocuments({ code: { $in: ['demo-alpha', 'demo-beta'] }, isDemo: true })).toBe(2);
  });

  it('refuses to run in production unless ALLOW_DEMO_SEED=true', () => {
    const production = {
      NODE_ENV: 'production',
      MONGODB_URI: 'mongodb://127.0.0.1:1/unused',
      JWT_SECRET: 'test-only-production-secret-0123456789abcdef',
      CLIENT_ORIGINS: 'https://desk.example.edu',
    };
    expect(() => assertDemoSeedAllowed(loadConfig(production))).toThrow(/Refusing to seed demo data/);
    expect(() => assertDemoSeedAllowed(loadConfig({ ...production, ALLOW_DEMO_SEED: 'true' }))).not.toThrow();
    expect(() => assertDemoSeedAllowed(config)).not.toThrow();
  });
});
