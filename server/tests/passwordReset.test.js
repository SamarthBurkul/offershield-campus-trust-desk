'use strict';

const request = require('supertest');
const { useTestDatabase } = require('./helpers/db');
const { createTestApp, loginAgent } = require('./helpers/auth');
const { createCollegeWithMembers, createSuperAdmin, createUser, TEST_PASSWORD } = require('./helpers/factories');
const { User, ROLES } = require('../src/models/User');
const { AuditLog } = require('../src/models/AuditLog');

useTestDatabase();

let app;
beforeAll(() => {
  app = createTestApp();
});
beforeEach(() => {
  jest.spyOn(console, 'warn').mockImplementation(() => {});
});

const NEW_PASSWORD = 'FreshPassw0rd-22';
const reset = (agent, id) => agent.post(`/api/v1/staff/users/${id}/reset-password`).send({});

describe('staff-assisted password reset', () => {
  it('a TPO head resets an officer and a student; the temporary password is returned once', async () => {
    const alpha = await createCollegeWithMembers('alpha');
    const head = await loginAgent(app, alpha.head.email, TEST_PASSWORD);

    for (const target of [alpha.officer, alpha.student]) {
      const res = await reset(head, target._id);
      expect(res.status).toBe(200);
      expect(res.body.temporaryPassword).toMatch(/^[A-Za-z0-9]{16}$/);
      expect(res.body.user).toEqual({ id: String(target._id), name: target.name, email: target.email, role: target.role, status: 'active' });
      const stored = await User.findById(target._id).lean();
      expect(stored.mustChangePassword).toBe(true);
      expect(stored.tokenVersion).toBe(1);
    }
  });

  it('an officer resets a student but gets 403 for another officer or the head', async () => {
    const alpha = await createCollegeWithMembers('alpha');
    const officer = await loginAgent(app, alpha.officer.email, TEST_PASSWORD);

    expect((await reset(officer, alpha.student._id)).status).toBe(200);
    const forbidden = await reset(officer, alpha.head._id);
    expect(forbidden.status).toBe(403);
    expect(forbidden.body.error.code).toBe('FORBIDDEN');
    expect((await User.findById(alpha.head._id).lean()).mustChangePassword).toBe(false);
  });

  it('a head cannot reset another TPO head or themselves', async () => {
    const alpha = await createCollegeWithMembers('alpha');
    const secondHead = await createUser({ college: alpha.college, role: ROLES.TPO_HEAD, email: 'head2@alpha.test.edu' });
    const head = await loginAgent(app, alpha.head.email, TEST_PASSWORD);

    expect((await reset(head, alpha.head._id)).body.error.code).toBe('CANNOT_MODIFY_SELF');
    expect((await reset(head, secondHead._id)).status).toBe(403);
  });

  it('revokes the old session; the temporary password works once and forces a change', async () => {
    const alpha = await createCollegeWithMembers('alpha');
    const studentSession = await loginAgent(app, alpha.student.email, TEST_PASSWORD);
    const head = await loginAgent(app, alpha.head.email, TEST_PASSWORD);

    const { temporaryPassword } = (await reset(head, alpha.student._id)).body;
    expect((await studentSession.get('/api/v1/auth/me')).status).toBe(401);
    expect((await request(app).post('/api/v1/auth/login').send({ email: alpha.student.email, password: TEST_PASSWORD })).status).toBe(401);

    const fresh = await loginAgent(app, alpha.student.email, temporaryPassword);
    expect((await fresh.get('/api/v1/auth/me')).body.user.mustChangePassword).toBe(true);
    expect((await fresh.get('/api/v1/cases/mine')).body.error.code).toBe('PASSWORD_CHANGE_REQUIRED');

    const changed = await fresh.post('/api/v1/auth/change-password').send({ currentPassword: temporaryPassword, newPassword: NEW_PASSWORD });
    expect(changed.status).toBe(200);
    expect((await fresh.get('/api/v1/cases/mine')).status).toBe(200);
    // The temporary password no longer works.
    expect((await request(app).post('/api/v1/auth/login').send({ email: alpha.student.email, password: temporaryPassword })).status).toBe(401);
  });

  it('audits the reset without the password', async () => {
    const alpha = await createCollegeWithMembers('alpha');
    const head = await loginAgent(app, alpha.head.email, TEST_PASSWORD);
    const { temporaryPassword } = (await reset(head, alpha.officer._id)).body;

    const entry = await AuditLog.findOne({ action: 'user.password_reset' }).lean();
    expect(entry).toMatchObject({ actorRole: 'tpo_head', entityType: 'user', metadata: { targetRole: 'placement_officer' } });
    expect(String(entry.entityId)).toBe(String(alpha.officer._id));
    expect(JSON.stringify(entry)).not.toContain(temporaryPassword);
  });

  it('a college B target is 404', async () => {
    const alpha = await createCollegeWithMembers('alpha');
    const beta = await createCollegeWithMembers('beta');
    const head = await loginAgent(app, alpha.head.email, TEST_PASSWORD);

    for (const target of [beta.student, beta.officer, beta.head]) {
      expect((await reset(head, target._id)).status).toBe(404);
    }
    expect((await User.findById(beta.student._id).lean()).mustChangePassword).toBe(false);
  });

  it('the super admin resets a TPO head, and only TPO heads', async () => {
    const alpha = await createCollegeWithMembers('alpha');
    const admin = await loginAgent(app, (await createSuperAdmin()).email, TEST_PASSWORD);

    const res = await admin.post(`/api/v1/admin/users/${alpha.head._id}/reset-password`).send({});
    expect(res.status).toBe(200);
    expect(res.body.user.role).toBe('tpo_head');
    expect((await User.findById(alpha.head._id).lean()).mustChangePassword).toBe(true);
    await loginAgent(app, alpha.head.email, res.body.temporaryPassword);

    expect((await admin.post(`/api/v1/admin/users/${alpha.student._id}/reset-password`).send({})).status).toBe(404);
    expect((await admin.post('/api/v1/admin/users/not-an-id/reset-password').send({})).status).toBe(404);
    const head = await loginAgent(app, alpha.officer.email, TEST_PASSWORD);
    expect((await head.post(`/api/v1/admin/users/${alpha.head._id}/reset-password`).send({})).status).toBe(403);
  });
});

describe('student disable and enable', () => {
  it('disabling revokes the session and blocks login; enabling restores access', async () => {
    const alpha = await createCollegeWithMembers('alpha');
    const studentSession = await loginAgent(app, alpha.student.email, TEST_PASSWORD);
    const officer = await loginAgent(app, alpha.officer.email, TEST_PASSWORD);

    const disabled = await officer.patch(`/api/v1/staff/students/${alpha.student._id}/status`).send({ status: 'disabled' });
    expect(disabled.status).toBe(200);
    expect(disabled.body.student.status).toBe('disabled');
    expect((await studentSession.get('/api/v1/auth/me')).status).toBe(401);
    expect((await request(app).post('/api/v1/auth/login').send({ email: alpha.student.email, password: TEST_PASSWORD })).status).toBe(401);
    expect(await AuditLog.countDocuments({ action: 'student.status_change' })).toBe(1);

    expect((await officer.patch(`/api/v1/staff/students/${alpha.student._id}/status`).send({ status: 'active' })).status).toBe(200);
    await loginAgent(app, alpha.student.email, TEST_PASSWORD);
  });

  it('staff accounts cannot be changed through the students endpoint', async () => {
    const alpha = await createCollegeWithMembers('alpha');
    const officer = await loginAgent(app, alpha.officer.email, TEST_PASSWORD);

    expect((await officer.patch(`/api/v1/staff/students/${alpha.head._id}/status`).send({ status: 'disabled' })).status).toBe(404);
  });
});
