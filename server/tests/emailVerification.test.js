'use strict';

const request = require('supertest');
const { useTestDatabase } = require('./helpers/db');
const { createTestApp, loginAgent } = require('./helpers/auth');
const { createCollege, createCollegeWithMembers, createUser, TEST_PASSWORD } = require('./helpers/factories');
const { User, ROLES } = require('../src/models/User');
const { AuditLog } = require('../src/models/AuditLog');
const { EmailLog } = require('../src/models/EmailLog');
const email = require('../src/services/email');
const { backfillEmailVerified } = require('../scripts/lib/backfillEmailVerified');

useTestDatabase();

let app;
beforeAll(() => {
  app = createTestApp({ REQUIRE_EMAIL_VERIFICATION: 'true' });
});
beforeEach(() => {
  jest.spyOn(console, 'error').mockImplementation(() => {});
  jest.spyOn(console, 'warn').mockImplementation(() => {});
  email.getProvider().outbox.length = 0;
});
afterEach(() => jest.restoreAllMocks());

const PASSWORD = 'StudentPass123';
const registration = (overrides = {}) => ({
  name: 'Asha Verify',
  email: 'asha@alpha.test.edu',
  password: PASSWORD,
  collegeCode: 'alpha',
  joinCode: 'TESTJOIN42',
  year: 2,
  branch: 'COMP',
  acceptPolicies: true,
  ...overrides,
});

/** The most recent verification code sent to an address (from the in-memory log provider). */
async function lastCode(address) {
  await email.flushEmails();
  const message = [...email.getProvider().outbox].reverse().find((item) => item.to === address && item.devCode);
  return message?.devCode;
}

async function registerAgent(overrides) {
  const agent = request.agent(app);
  const res = await agent.post('/api/v1/auth/register').send(registration(overrides));
  expect(res.status).toBe(201);
  return { agent, res };
}

describe('email verification on registration (G8)', () => {
  beforeEach(async () => {
    await createCollegeWithMembers('alpha');
  });

  test('a password sign-up is unverified, gets a 6-digit code and is limited to the allowed routes', async () => {
    const { agent, res } = await registerAgent();
    expect(res.body.user.emailVerified).toBe(false);
    expect(res.body.user.authMethods).toEqual(['password']);
    const code = await lastCode('asha@alpha.test.edu');
    expect(code).toMatch(/^\d{6}$/);

    const stored = await User.findOne({ email: 'asha@alpha.test.edu' }).select('+emailOtp').lean();
    expect(stored.emailOtp.hash).toMatch(/^[a-f0-9]{64}$/);
    expect(stored.emailOtp.hash).not.toContain(code);
    expect(stored.emailOtp.expiresAt - stored.emailOtp.lastSentAt).toBe(10 * 60 * 1000);

    expect((await agent.get('/api/v1/auth/me')).status).toBe(200);
    const blocked = await agent.get('/api/v1/notifications');
    expect(blocked.status).toBe(403);
    expect(blocked.body.error.code).toBe('EMAIL_NOT_VERIFIED');
    expect((await agent.get('/api/v1/account')).body.error.code).toBe('EMAIL_NOT_VERIFIED');
  });

  test('the right code verifies, audits and unlocks the account; the code cannot be reused', async () => {
    const { agent } = await registerAgent();
    const code = await lastCode('asha@alpha.test.edu');
    const res = await agent.post('/api/v1/auth/verify-email').send({ code });
    expect(res.status).toBe(200);
    expect(res.body.user.emailVerified).toBe(true);
    expect((await agent.get('/api/v1/notifications')).status).toBe(200);
    const stored = await User.findOne({ email: 'asha@alpha.test.edu' }).select('+emailOtp').lean();
    expect(stored.emailOtp).toBeUndefined();
    const entry = await AuditLog.findOne({ action: 'auth.email_verified' }).lean();
    expect(JSON.stringify(entry.metadata)).not.toContain(code);
    expect((await agent.post('/api/v1/auth/verify-email').send({ code })).status).toBe(200);
  });

  test('wrong codes give INVALID_CODE; after 5 attempts even the right code fails', async () => {
    const { agent } = await registerAgent();
    const code = await lastCode('asha@alpha.test.edu');
    const wrong = code === '000000' ? '111111' : '000000';
    for (let i = 0; i < 5; i += 1) {
      const res = await agent.post('/api/v1/auth/verify-email').send({ code: wrong });
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('INVALID_CODE');
    }
    expect((await agent.post('/api/v1/auth/verify-email').send({ code })).body.error.code).toBe('INVALID_CODE');
    expect((await agent.post('/api/v1/auth/verify-email').send({ code: '12345' })).status).toBe(400);
  });

  test('an expired code fails', async () => {
    const { agent } = await registerAgent();
    const code = await lastCode('asha@alpha.test.edu');
    await User.updateOne({ email: 'asha@alpha.test.edu' }, { $set: { 'emailOtp.expiresAt': new Date(Date.now() - 1000) } });
    expect((await agent.post('/api/v1/auth/verify-email').send({ code })).body.error.code).toBe('INVALID_CODE');
  });

  test('resend has a 60 s cooldown and a 5-per-hour cap, and invalidates the previous code', async () => {
    const { agent } = await registerAgent();
    const first = await lastCode('asha@alpha.test.edu');
    const tooSoon = await agent.post('/api/v1/auth/resend-verification');
    expect(tooSoon.status).toBe(429);
    expect(tooSoon.body.error.code).toBe('RESEND_TOO_SOON');
    expect(tooSoon.body.error.details.retryAfterSeconds).toBeGreaterThan(0);

    const rewind = () => User.updateOne({ email: 'asha@alpha.test.edu' }, { $set: { 'emailOtp.lastSentAt': new Date(Date.now() - 61_000) } });
    for (let i = 0; i < 4; i += 1) {
      await rewind();
      const res = await agent.post('/api/v1/auth/resend-verification');
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ sent: true, retryAfterSeconds: 60 });
    }
    await rewind();
    const capped = await agent.post('/api/v1/auth/resend-verification');
    expect(capped.status).toBe(429);
    expect(capped.body.error.code).toBe('RESEND_LIMIT');

    const latest = await lastCode('asha@alpha.test.edu');
    if (latest !== first) expect((await agent.post('/api/v1/auth/verify-email').send({ code: first })).body.error.code).toBe('INVALID_CODE');
    expect((await agent.post('/api/v1/auth/verify-email').send({ code: latest })).status).toBe(200);
  });

  test('verification emails are logged without the code; staff accounts are verified at creation', async () => {
    await registerAgent();
    const code = await lastCode('asha@alpha.test.edu');
    const logs = await EmailLog.find({}).lean();
    expect(logs).toHaveLength(1);
    expect(logs[0]).toMatchObject({ type: 'verify_email', priority: 'critical', status: 'sent' });
    expect(JSON.stringify(logs)).not.toContain(code);

    const head = await loginAgent(app, 'head@alpha.test.edu', TEST_PASSWORD);
    const created = await head.post('/api/v1/staff/officers').send({ name: 'New Officer', email: 'new.officer@alpha.test.edu' });
    expect(created.status).toBe(201);
    expect((await User.findOne({ email: 'new.officer@alpha.test.edu' }).lean()).emailVerifiedAt).toBeInstanceOf(Date);
  });

  test('without REQUIRE_EMAIL_VERIFICATION a sign-up is verified at once and no code is sent', async () => {
    const plain = createTestApp();
    const res = await request(plain).post('/api/v1/auth/register').send(registration({ email: 'plain@alpha.test.edu' }));
    expect(res.status).toBe(201);
    expect(res.body.user.emailVerified).toBe(true);
    await email.flushEmails();
    expect(email.getProvider().outbox).toHaveLength(0);
  });
});

describe('route order: email verification before pending approval (G9)', () => {
  test('a pending, unverified student can verify; approval is refused until verified', async () => {
    const { college } = await createCollege({ code: 'manual', studentVerification: 'manual_approval' });
    await createUser({ college, role: ROLES.TPO_HEAD, email: 'head@manual.test.edu' });
    const { agent } = await registerAgent({ collegeCode: 'manual', email: 'kiran@gmail.com' });
    const blocked = await agent.get('/api/v1/notifications');
    expect(blocked.body.error.code).toBe('EMAIL_NOT_VERIFIED');

    const head = await loginAgent(app, 'head@manual.test.edu', TEST_PASSWORD);
    const student = await User.findOne({ email: 'kiran@gmail.com' }).lean();
    const refused = await head.post(`/api/v1/staff/students/${student._id}/approve`).send({});
    expect(refused.status).toBe(409);
    expect(refused.body.error.code).toBe('EMAIL_NOT_VERIFIED');
    const bulk = await head.post('/api/v1/staff/students/bulk-approve').send({ ids: [String(student._id)] });
    expect(bulk.body).toEqual({ approved: [], skipped: 1 });

    const list = await head.get('/api/v1/staff/students?status=pending_approval');
    expect(list.body.students[0]).toMatchObject({ emailVerified: false, authMethods: ['password'] });

    const code = await lastCode('kiran@gmail.com');
    expect((await agent.post('/api/v1/auth/verify-email').send({ code })).status).toBe(200);
    expect((await agent.get('/api/v1/notifications')).body.error.code).toBe('ACCOUNT_PENDING_APPROVAL');
    expect((await head.post(`/api/v1/staff/students/${student._id}/approve`).send({})).status).toBe(200);
    expect((await agent.get('/api/v1/notifications')).status).toBe(200);
  });
});

describe('ops:backfill-email-verified (G10)', () => {
  test('sets emailVerifiedAt from createdAt and authMethods where missing; idempotent; skips pending codes', async () => {
    const { college } = await createCollege({ code: 'alpha' });
    const legacy = await createUser({ college, role: ROLES.STUDENT, email: 'legacy@alpha.test.edu' });
    const waiting = await createUser({ college, role: ROLES.STUDENT, email: 'waiting@alpha.test.edu' });
    const createdAt = new Date('2026-01-15T10:00:00Z');
    await User.collection.updateOne({ _id: legacy._id }, { $unset: { emailVerifiedAt: 1, authMethods: 1 }, $set: { createdAt } });
    await User.collection.updateOne(
      { _id: waiting._id },
      { $set: { emailVerifiedAt: null, emailOtp: { hash: 'x', expiresAt: new Date(), attempts: 0, lastSentAt: new Date() } } },
    );

    const first = await backfillEmailVerified();
    expect(first).toEqual({ emailVerifiedSet: 1, authMethodsSet: 1 });
    const updated = await User.collection.findOne({ _id: legacy._id });
    expect(updated.emailVerifiedAt).toEqual(createdAt);
    expect(updated.authMethods).toEqual(['password']);
    expect((await User.collection.findOne({ _id: waiting._id })).emailVerifiedAt).toBeNull();

    expect(await backfillEmailVerified()).toEqual({ emailVerifiedSet: 0, authMethodsSet: 0 });
  });
});

describe('the gate applies to students only (Phase 9.1)', () => {
  test('legacy unverified tpo_head, placement_officer and super_admin reach their routes; a student is still gated', async () => {
    const { college, head, officer, student } = await createCollegeWithMembers('alpha');
    const { createSuperAdmin } = require('./helpers/factories');
    const root = await createSuperAdmin();
    await User.updateMany({}, { $set: { emailVerifiedAt: null } });

    const headAgent = await loginAgent(app, 'head@alpha.test.edu', TEST_PASSWORD);
    expect((await headAgent.get('/api/v1/auth/me')).body.user.emailVerified).toBe(false);
    expect((await headAgent.get('/api/v1/staff/students')).status).toBe(200);
    expect((await headAgent.get('/api/v1/account')).status).toBe(200);
    const officerAgent = await loginAgent(app, 'officer@alpha.test.edu', TEST_PASSWORD);
    expect((await officerAgent.get('/api/v1/staff/cases')).status).toBe(200);
    expect((await officerAgent.get('/api/v1/notifications')).status).toBe(200);
    const rootAgent = await loginAgent(app, 'root@platform.test', TEST_PASSWORD);
    expect((await rootAgent.get('/api/v1/admin/colleges')).status).toBe(200);

    const studentAgent = await loginAgent(app, 'student@alpha.test.edu', TEST_PASSWORD);
    const blocked = await studentAgent.get('/api/v1/notifications');
    expect(blocked.status).toBe(403);
    expect(blocked.body.error.code).toBe('EMAIL_NOT_VERIFIED');
    expect([college, head, officer, student, root].every(Boolean)).toBe(true);
  });
});
