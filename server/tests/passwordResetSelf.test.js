'use strict';

const request = require('supertest');
const { useTestDatabase } = require('./helpers/db');
const { createTestApp, loginAgent } = require('./helpers/auth');
const { createCollegeWithMembers, createUser, TEST_PASSWORD } = require('./helpers/factories');
const { User, ROLES } = require('../src/models/User');
const { AuditLog } = require('../src/models/AuditLog');
const { EmailLog } = require('../src/models/EmailLog');
const { PasswordResetToken } = require('../src/models/PasswordResetToken');
const { loadConfig } = require('../src/config/env');
const { createApp } = require('../src/app');
const email = require('../src/services/email');

useTestDatabase();

let app;
beforeEach(() => {
  jest.spyOn(console, 'error').mockImplementation(() => {});
  jest.spyOn(console, 'warn').mockImplementation(() => {});
  // A fresh app per test: the forgot-password limiters (3 per address an hour) start empty.
  app = createTestApp();
});
afterEach(() => jest.restoreAllMocks());

const NEW_PASSWORD = 'BrandNewPass99';
const GENERIC = { message: 'If an account exists for that address, we have sent instructions to it.' };

const forgot = (address, target = app) => request(target).post('/api/v1/auth/forgot-password').send({ email: address });
const outbox = () => email.getProvider().outbox;

/** The token from the most recent reset email sent to an address. */
async function lastToken(address) {
  await email.flushEmails();
  const message = [...outbox()].reverse().find((item) => item.to === address && item.devLink);
  return message ? new URL(message.devLink).hash.replace('#token=', '') : undefined;
}

describe('POST /auth/forgot-password (G11)', () => {
  beforeEach(async () => {
    await createCollegeWithMembers('alpha');
  });

  test('always answers 202 with the same body; only an active, verified password account gets a link', async () => {
    const { college } = await createCollegeWithMembers('beta');
    await createUser({ college, role: ROLES.STUDENT, email: 'unverified@beta.test.edu', emailVerifiedAt: null });
    await createUser({ college, role: ROLES.STUDENT, email: 'disabled@beta.test.edu', status: 'disabled' });

    for (const address of ['student@alpha.test.edu', 'nobody@alpha.test.edu', 'unverified@beta.test.edu', 'disabled@beta.test.edu']) {
      const res = await forgot(address);
      expect(res.status).toBe(202);
      expect(res.body).toEqual(GENERIC);
    }
    await email.flushEmails();
    expect(outbox().map((item) => item.to)).toEqual(['student@alpha.test.edu']);
    const message = outbox()[0];
    expect(message.subject).toBe('Reset your OfferShield password');
    expect(message.devLink).toMatch(/^http:\/\/localhost:5173\/reset-password#token=[A-Za-z0-9_-]{43}$/);
    expect(message.text).toContain(message.devLink);

    const stored = await PasswordResetToken.find({}).lean();
    expect(stored).toHaveLength(1);
    const token = new URL(message.devLink).hash.replace('#token=', '');
    expect(stored[0].tokenHash).toMatch(/^[a-f0-9]{64}$/);
    expect(stored[0].tokenHash).not.toBe(token);
    expect(stored[0].expiresAt - stored[0].createdAt).toBeGreaterThanOrEqual(30 * 60 * 1000 - 1000);
    expect(JSON.stringify(await EmailLog.find({}).lean())).not.toContain(token);
  });

  test('at most 3 active links per account; the email limiter allows 3 requests an hour', async () => {
    for (let i = 0; i < 3; i += 1) expect((await forgot('student@alpha.test.edu')).status).toBe(202);
    const limited = await forgot('student@alpha.test.edu');
    expect(limited.status).toBe(429);
    await email.flushEmails();
    expect(await PasswordResetToken.countDocuments()).toBe(3);

    // A fresh app (new limiter) still cannot create a 4th active link.
    const other = createTestApp();
    expect((await forgot('student@alpha.test.edu', other)).status).toBe(202);
    await email.flushEmails();
    expect(await PasswordResetToken.countDocuments()).toBe(3);
  });

  test('the per-IP limiter allows 20 requests an hour', async () => {
    const limitedApp = createTestApp();
    for (let i = 0; i < 20; i += 1) expect((await forgot(`person${i}@alpha.test.edu`, limitedApp)).status).toBe(202);
    expect((await forgot('person-last@alpha.test.edu', limitedApp)).status).toBe(429);
  });

  test('with email off (production, log provider) it answers the same 202 and sends nothing', async () => {
    const prod = createApp(
      loadConfig({ NODE_ENV: 'production', CLIENT_ORIGINS: 'http://127.0.0.1', MONGODB_URI: 'mongodb://127.0.0.1/x', JWT_SECRET: 'test-only-secret-value-0123456789abcdef', TRUST_PROXY: '0' }),
      { serveClient: false, logSink: null },
    );
    const res = await forgot('student@alpha.test.edu', prod);
    expect(res.status).toBe(202);
    expect(res.body).toEqual(GENERIC);
    await email.flushEmails();
    expect(await PasswordResetToken.countDocuments()).toBe(0);
    expect(await EmailLog.countDocuments()).toBe(0);
  });

  test('rejects a malformed body', async () => {
    expect((await request(app).post('/api/v1/auth/forgot-password').send({ email: 'a@b.c', extra: 1 })).status).toBe(400);
  });
});

describe('POST /auth/reset-password (G12)', () => {
  beforeEach(async () => {
    await createCollegeWithMembers('alpha');
  });

  test('sets the password, ends old sessions, clears mustChangePassword, audits and emails', async () => {
    const student = await User.findOne({ email: 'student@alpha.test.edu' });
    await User.updateOne({ _id: student._id }, { $set: { mustChangePassword: true } });
    const oldSession = await loginAgent(app, 'student@alpha.test.edu', TEST_PASSWORD);
    expect((await oldSession.get('/api/v1/auth/me')).status).toBe(200);

    await forgot('student@alpha.test.edu');
    const token = await lastToken('student@alpha.test.edu');
    outbox().length = 0;
    const res = await request(app).post('/api/v1/auth/reset-password').send({ token, newPassword: NEW_PASSWORD });
    expect(res.status).toBe(200);

    expect((await oldSession.get('/api/v1/auth/me')).status).toBe(401);
    expect((await request(app).post('/api/v1/auth/login').send({ email: 'student@alpha.test.edu', password: TEST_PASSWORD })).status).toBe(401);
    const login = await request(app).post('/api/v1/auth/login').send({ email: 'student@alpha.test.edu', password: NEW_PASSWORD });
    expect(login.status).toBe(200);
    expect(login.body.user.mustChangePassword).toBe(false);

    const entry = await AuditLog.findOne({ action: 'auth.password_reset_self' }).lean();
    expect(entry).toBeTruthy();
    expect(JSON.stringify(entry)).not.toContain(token);
    await email.flushEmails();
    expect(outbox().map((item) => item.subject)).toEqual(['Your OfferShield password was changed']);
    expect(await EmailLog.countDocuments({ type: 'password_changed', priority: 'critical' })).toBe(1);
  });

  test('a token works once; expired, unknown and malformed tokens give INVALID_TOKEN', async () => {
    await forgot('student@alpha.test.edu');
    const token = await lastToken('student@alpha.test.edu');
    expect((await request(app).post('/api/v1/auth/reset-password').send({ token, newPassword: NEW_PASSWORD })).status).toBe(200);
    const reused = await request(app).post('/api/v1/auth/reset-password').send({ token, newPassword: 'AnotherPass77' });
    expect(reused.status).toBe(400);
    expect(reused.body.error.code).toBe('INVALID_TOKEN');

    await forgot('head@alpha.test.edu');
    const headToken = await lastToken('head@alpha.test.edu');
    await PasswordResetToken.updateMany({ usedAt: null }, { $set: { expiresAt: new Date(Date.now() - 1000) } });
    expect((await request(app).post('/api/v1/auth/reset-password').send({ token: headToken, newPassword: NEW_PASSWORD })).body.error.code).toBe('INVALID_TOKEN');
    expect((await request(app).post('/api/v1/auth/reset-password').send({ token: 'x'.repeat(43), newPassword: NEW_PASSWORD })).body.error.code).toBe('INVALID_TOKEN');
    expect((await request(app).post('/api/v1/auth/reset-password').send({ token: 'short', newPassword: NEW_PASSWORD })).status).toBe(400);
  });

  test('using one link invalidates the other outstanding links; weak passwords are refused', async () => {
    const other = createTestApp();
    await forgot('student@alpha.test.edu');
    const first = await lastToken('student@alpha.test.edu');
    await forgot('student@alpha.test.edu', other);
    const second = await lastToken('student@alpha.test.edu');
    expect(first).not.toBe(second);
    expect((await request(app).post('/api/v1/auth/reset-password').send({ token: second, newPassword: 'short' })).status).toBe(400);
    expect((await request(app).post('/api/v1/auth/reset-password').send({ token: second, newPassword: NEW_PASSWORD })).status).toBe(200);
    expect((await request(app).post('/api/v1/auth/reset-password').send({ token: first, newPassword: NEW_PASSWORD })).body.error.code).toBe('INVALID_TOKEN');
  });

  test('a disabled account cannot use a link issued before it was disabled', async () => {
    await forgot('student@alpha.test.edu');
    const token = await lastToken('student@alpha.test.edu');
    await User.updateOne({ email: 'student@alpha.test.edu' }, { $set: { status: 'disabled' } });
    expect((await request(app).post('/api/v1/auth/reset-password').send({ token, newPassword: NEW_PASSWORD })).body.error.code).toBe('INVALID_TOKEN');
  });
});
