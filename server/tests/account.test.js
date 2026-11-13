'use strict';

const request = require('supertest');
const { useTestDatabase } = require('./helpers/db');
const { createTestApp, loginAgent } = require('./helpers/auth');
const { createCollegeWithMembers, createSuperAdmin, TEST_PASSWORD } = require('./helpers/factories');
const { User } = require('../src/models/User');
const { AuditLog } = require('../src/models/AuditLog');

useTestDatabase();

let app;
beforeAll(() => {
  app = createTestApp();
});
beforeEach(() => {
  jest.spyOn(console, 'warn').mockImplementation(() => {});
});
afterEach(() => jest.restoreAllMocks());

describe('GET/PATCH /account (G14)', () => {
  beforeEach(async () => {
    await createCollegeWithMembers('alpha');
    await createCollegeWithMembers('beta');
  });

  test('returns the own account with verification, sign-in methods and preferences; never secrets', async () => {
    const agent = await loginAgent(app, 'student@alpha.test.edu', TEST_PASSWORD);
    const res = await agent.get('/api/v1/account');
    expect(res.status).toBe(200);
    expect(res.body.account).toMatchObject({
      email: 'student@alpha.test.edu',
      role: 'student',
      emailVerified: true,
      authMethods: ['password'],
      hasPassword: true,
      year: 2,
      branch: 'COMP',
      emailPrefs: { caseUpdates: true, advisories: true, staffAlerts: true },
    });
    expect(res.text).not.toMatch(/passwordHash|tokenVersion|emailOtp|googleSub/);
    expect((await request(app).get('/api/v1/account')).status).toBe(401);
  });

  test('a student updates name, year, branch and preferences; the audit records field names only', async () => {
    const agent = await loginAgent(app, 'student@alpha.test.edu', TEST_PASSWORD);
    const res = await agent.patch('/api/v1/account').send({ name: 'Asha Renamed', year: 3, branch: 'IT', emailPrefs: { advisories: false } });
    expect(res.status).toBe(200);
    expect(res.body.account).toMatchObject({ name: 'Asha Renamed', year: 3, branch: 'IT', emailPrefs: { caseUpdates: true, advisories: false, staffAlerts: true } });
    const entry = await AuditLog.findOne({ action: 'user.profile_update' }).lean();
    expect(entry.metadata).toEqual({ fields: ['name', 'year', 'branch'] });
    expect(JSON.stringify(entry)).not.toContain('Asha Renamed');

    // Preferences alone are not a profile change.
    await agent.patch('/api/v1/account').send({ emailPrefs: { advisories: true } });
    expect(await AuditLog.countDocuments({ action: 'user.profile_update' })).toBe(1);
  });

  test('email cannot be changed; unknown branch, bad year and empty bodies are refused', async () => {
    const agent = await loginAgent(app, 'student@alpha.test.edu', TEST_PASSWORD);
    expect((await agent.patch('/api/v1/account').send({ email: 'new@alpha.test.edu' })).status).toBe(400);
    expect((await agent.patch('/api/v1/account').send({ branch: 'NOPE' })).status).toBe(400);
    expect((await agent.patch('/api/v1/account').send({ year: 6 })).status).toBe(400);
    expect((await agent.patch('/api/v1/account').send({})).status).toBe(400);
    expect((await agent.patch('/api/v1/account').send({ role: 'tpo_head' })).status).toBe(400);
    expect((await User.findOne({ email: 'student@alpha.test.edu' }).lean()).role).toBe('student');
  });

  test('staff can rename and set staff alerts but not year/branch; the super admin works too', async () => {
    const head = await loginAgent(app, 'head@alpha.test.edu', TEST_PASSWORD);
    expect((await head.patch('/api/v1/account').send({ year: 2 })).status).toBe(400);
    const res = await head.patch('/api/v1/account').send({ name: 'Head Person', emailPrefs: { staffAlerts: false } });
    expect(res.status).toBe(200);
    expect(res.body.account).toMatchObject({ name: 'Head Person', year: null, branch: null, emailPrefs: { staffAlerts: false } });

    await createSuperAdmin();
    const root = await loginAgent(app, 'root@platform.test', TEST_PASSWORD);
    expect((await root.patch('/api/v1/account').send({ name: 'Platform Root' })).body.account.name).toBe('Platform Root');
  });

  test('a user only ever changes their own record', async () => {
    const agent = await loginAgent(app, 'student@alpha.test.edu', TEST_PASSWORD);
    await agent.patch('/api/v1/account').send({ name: 'Only Me' });
    expect((await User.findOne({ email: 'student@beta.test.edu' }).lean()).name).not.toBe('Only Me');
    expect((await User.findOne({ email: 'head@alpha.test.edu' }).lean()).name).not.toBe('Only Me');
  });
});
