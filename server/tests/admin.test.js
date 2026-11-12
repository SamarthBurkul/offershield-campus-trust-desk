'use strict';

const request = require('supertest');
const { useTestDatabase } = require('./helpers/db');
const { createTestApp, loginAgent } = require('./helpers/auth');
const { TEST_PASSWORD, createSuperAdmin, createCollegeWithMembers } = require('./helpers/factories');
const { College } = require('../src/models/College');
const { AuditLog } = require('../src/models/AuditLog');

useTestDatabase();

let app;
let root;
let rootUser;
beforeAll(() => {
  app = createTestApp();
});
beforeEach(async () => {
  jest.spyOn(console, 'warn').mockImplementation(() => {});
  rootUser = await createSuperAdmin();
  root = await loginAgent(app, 'root@platform.test', TEST_PASSWORD);
});

const NEW_COLLEGE = { name: 'Gamma Institute', code: 'gamma', emailDomains: ['gamma.edu', 'Students.Gamma.edu'] };

async function createGamma() {
  const res = await root.post('/api/v1/admin/colleges').send(NEW_COLLEGE);
  expect(res.status).toBe(201);
  return res.body;
}

function register(joinCode, email = 'kiran@gamma.edu') {
  return request(app).post('/api/v1/auth/register').send({
    name: 'Kiran',
    email,
    password: 'KiranPass123',
    collegeCode: 'gamma',
    joinCode,
    year: 2,
    branch: 'IT',
    acceptPolicies: true,
  });
}

describe('super admin college management', () => {
  it('20. create returns the join code once; GET responses never include it or its hash', async () => {
    const { college, studentJoinCode } = await createGamma();

    expect(studentJoinCode).toMatch(/^[A-HJKMNP-Z2-9]{10}$/);
    expect(college).toMatchObject({
      name: 'Gamma Institute',
      code: 'gamma',
      emailDomains: ['gamma.edu', 'students.gamma.edu'],
      branches: ['COMP', 'IT', 'EXTC', 'MECH', 'CIVIL', 'AIDS'],
      status: 'active',
      staffCount: 0,
    });
    expect(college).not.toHaveProperty('studentJoinCodeHash');

    const list = await root.get('/api/v1/admin/colleges');
    const detail = await root.get(`/api/v1/admin/colleges/${college.id}`);
    for (const res of [list, detail]) {
      expect(res.status).toBe(200);
      expect(res.text).not.toContain(studentJoinCode);
      expect(res.text).not.toMatch(/joinCode|JoinCode|Hash|\$2[aby]\$/);
    }
    expect(detail.body.college.staffCount).toBe(0);

    const stored = await College.findById(college.id).select('+studentJoinCodeHash').lean();
    expect(stored.studentJoinCodeHash).toMatch(/^\$2[aby]\$12\$/);
    expect(stored.studentJoinCodeHash).not.toContain(studentJoinCode);
  });

  it('rejects a duplicate college code with 409 and unknown or malformed ids with 404', async () => {
    await createGamma();
    const duplicate = await root.post('/api/v1/admin/colleges').send(NEW_COLLEGE);

    expect(duplicate.status).toBe(409);
    expect(duplicate.body.error.code).toBe('COLLEGE_CODE_TAKEN');
    expect((await root.get('/api/v1/admin/colleges/507f1f77bcf86cd799439011')).status).toBe(404);
    expect((await root.get('/api/v1/admin/colleges/not-an-id')).status).toBe(404);
  });

  it('does not list students and counts staff only', async () => {
    const alpha = await createCollegeWithMembers('alpha');

    const detail = await root.get(`/api/v1/admin/colleges/${alpha.college._id}`);
    const staff = await root.get(`/api/v1/admin/colleges/${alpha.college._id}/staff`);

    expect(detail.body.college.staffCount).toBe(2);
    expect(staff.status).toBe(200);
    expect(staff.body.staff.map((member) => member.role).sort()).toEqual(['placement_officer', 'tpo_head']);
    expect(staff.text).not.toContain('student@alpha.test.edu');
    expect(Object.keys(staff.body.staff[0]).sort()).toEqual(['email', 'id', 'name', 'role', 'status']);
  });

  it('PATCH updates allowed fields and rejects unknown keys', async () => {
    const { college } = await createGamma();

    const res = await root.patch(`/api/v1/admin/colleges/${college.id}`).send({ name: 'Gamma University', branches: ['comp', 'ai'] });
    const bad = await root.patch(`/api/v1/admin/colleges/${college.id}`).send({ code: 'renamed' });

    expect(res.status).toBe(200);
    expect(res.body.college).toMatchObject({ name: 'Gamma University', branches: ['COMP', 'AI'] });
    expect(bad.status).toBe(400);
    expect(bad.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('21. rotating the join code makes the old code fail and the new code succeed', async () => {
    const { college, studentJoinCode: oldCode } = await createGamma();

    const rotated = await root.post(`/api/v1/admin/colleges/${college.id}/rotate-join-code`);
    expect(rotated.status).toBe(200);
    const newCode = rotated.body.studentJoinCode;
    expect(newCode).toMatch(/^[A-HJKMNP-Z2-9]{10}$/);
    expect(newCode).not.toBe(oldCode);

    const withOld = await register(oldCode);
    expect(withOld.status).toBe(400);
    expect(withOld.body.error.code).toBe('REGISTRATION_REJECTED');

    const withNew = await register(newCode);
    expect(withNew.status).toBe(201);
  });

  it('22. creates a TPO head who can log in with mustChangePassword=true; a wrong-domain email gets 400', async () => {
    const { college } = await createGamma();

    const created = await root.post(`/api/v1/admin/colleges/${college.id}/tpo-heads`).send({ name: 'Head Gamma', email: 'head@gamma.edu' });
    expect(created.status).toBe(201);
    expect(created.body.user).toMatchObject({ email: 'head@gamma.edu', role: 'tpo_head', status: 'active' });
    const { temporaryPassword } = created.body;
    expect(temporaryPassword).toMatch(/^[A-Za-z0-9]{16}$/);

    const login = await request(app).post('/api/v1/auth/login').send({ email: 'head@gamma.edu', password: temporaryPassword });
    expect(login.status).toBe(200);
    expect(login.body.user).toMatchObject({ role: 'tpo_head', mustChangePassword: true, collegeId: college.id });

    const wrongDomain = await root
      .post(`/api/v1/admin/colleges/${college.id}/tpo-heads`)
      .send({ name: 'Outsider', email: 'head@elsewhere.edu' });
    expect(wrongDomain.status).toBe(400);
    expect(wrongDomain.body.error.code).toBe('EMAIL_DOMAIN_MISMATCH');

    const duplicate = await root.post(`/api/v1/admin/colleges/${college.id}/tpo-heads`).send({ name: 'Again', email: 'head@gamma.edu' });
    expect(duplicate.status).toBe(409);
  });

  it('a suspended college blocks existing sessions and new logins of its users', async () => {
    const alpha = await createCollegeWithMembers('alpha');
    const student = await loginAgent(app, 'student@alpha.test.edu', TEST_PASSWORD);

    const suspend = await root.patch(`/api/v1/admin/colleges/${alpha.college._id}`).send({ status: 'suspended' });

    expect(suspend.status).toBe(200);
    expect((await student.get('/api/v1/auth/me')).status).toBe(401);
    expect((await request(app).post('/api/v1/auth/login').send({ email: 'student@alpha.test.edu', password: TEST_PASSWORD })).status).toBe(401);
  });
});

describe('audit log', () => {
  it('23. records college and staff actions with the right collegeId and no secrets', async () => {
    const { college, studentJoinCode } = await createGamma();
    await root.patch(`/api/v1/admin/colleges/${college.id}`).send({ name: 'Gamma University' });
    const rotated = await root.post(`/api/v1/admin/colleges/${college.id}/rotate-join-code`);
    const created = await root.post(`/api/v1/admin/colleges/${college.id}/tpo-heads`).send({ name: 'Head Gamma', email: 'head@gamma.edu' });

    const head = request.agent(app);
    await head.post('/api/v1/auth/login').send({ email: 'head@gamma.edu', password: created.body.temporaryPassword });
    await head.post('/api/v1/auth/change-password').send({ currentPassword: created.body.temporaryPassword, newPassword: 'HeadGammaPass1' });
    const officer = await head.post('/api/v1/staff/officers').send({ name: 'Officer Gamma', email: 'officer@gamma.edu' });
    await head.patch(`/api/v1/staff/officers/${officer.body.user.id}/status`).send({ status: 'disabled' });

    const entries = await AuditLog.find().sort({ createdAt: 1 }).lean();
    const actions = entries.map((entry) => entry.action);
    expect(actions).toEqual(
      expect.arrayContaining([
        'college.create',
        'college.update',
        'college.join_code_rotate',
        'staff.create',
        'auth.password_change',
        'staff.status_change',
      ]),
    );

    for (const entry of entries) {
      expect(String(entry.collegeId)).toBe(college.id);
      expect(entry.createdAt).toBeInstanceOf(Date);
    }
    const byAction = (action) => entries.filter((entry) => entry.action === action);
    expect(String(byAction('college.create')[0].actorId)).toBe(String(rootUser._id));
    expect(byAction('college.create')[0].actorRole).toBe('super_admin');
    expect(byAction('staff.create').map((entry) => entry.actorRole).sort()).toEqual(['super_admin', 'tpo_head']);
    expect(byAction('staff.status_change')[0].metadata).toEqual({ from: 'active', to: 'disabled' });

    const serialized = JSON.stringify(entries);
    for (const secret of [
      studentJoinCode,
      rotated.body.studentJoinCode,
      created.body.temporaryPassword,
      officer.body.temporaryPassword,
      'HeadGammaPass1',
      TEST_PASSWORD,
    ]) {
      expect(serialized).not.toContain(secret);
    }
    expect(serialized).not.toMatch(/\$2[aby]\$/);
    expect(JSON.stringify(entries.map((entry) => entry.metadata))).not.toMatch(/password|hash|token|joinCode/i);
  });

  it('24. AuditLog update and delete attempts throw', async () => {
    await createGamma();
    const entry = await AuditLog.findOne();

    await expect(AuditLog.updateOne({ _id: entry._id }, { action: 'tampered' })).rejects.toThrow(/append-only/);
    await expect(AuditLog.updateMany({}, { action: 'tampered' })).rejects.toThrow(/append-only/);
    await expect(AuditLog.findOneAndUpdate({ _id: entry._id }, { action: 'tampered' })).rejects.toThrow(/append-only/);
    await expect(AuditLog.deleteOne({ _id: entry._id })).rejects.toThrow(/append-only/);
    await expect(AuditLog.deleteMany({})).rejects.toThrow(/append-only/);
    await expect(AuditLog.findOneAndDelete({ _id: entry._id })).rejects.toThrow(/append-only/);
    await expect(entry.deleteOne()).rejects.toThrow(/append-only/);
    entry.action = 'tampered';
    await expect(entry.save()).rejects.toThrow(/append-only/);

    const stored = await AuditLog.findById(entry._id).lean();
    expect(stored.action).toBe('college.create');
  });
});
