'use strict';

const request = require('supertest');
const { useTestDatabase } = require('./helpers/db');
const { createTestApp, loginAgent } = require('./helpers/auth');
const { createCollege, createCollegeWithMembers, createUser, createSuperAdmin, TEST_PASSWORD } = require('./helpers/factories');
const { User, ROLES } = require('../src/models/User');
const { AuditLog } = require('../src/models/AuditLog');
const { Notification } = require('../src/models/Notification');
const { POLICIES_VERSION } = require('../src/constants/policies');

useTestDatabase();

const without = (object, key) => Object.fromEntries(Object.entries(object).filter(([name]) => name !== key));

let app;
beforeAll(() => {
  app = createTestApp();
});
beforeEach(() => {
  jest.spyOn(console, 'warn').mockImplementation(() => {});
});

const STUDENT_PASSWORD = 'StudentPass123';

function registration(overrides = {}) {
  return {
    name: 'Kiran Gmail',
    email: 'kiran.student@gmail.com',
    password: STUDENT_PASSWORD,
    collegeCode: 'manual',
    joinCode: 'TESTJOIN42',
    year: 3,
    branch: 'COMP',
    acceptPolicies: true,
    ...overrides,
  };
}

/** A manual_approval college with a head and an officer, plus an email_domain college "beta". */
async function setup() {
  const { college } = await createCollege({ code: 'manual', domain: 'manual.test.edu', studentVerification: 'manual_approval' });
  const head = await createUser({ college, role: ROLES.TPO_HEAD, email: 'head@manual.test.edu' });
  const officer = await createUser({ college, role: ROLES.PLACEMENT_OFFICER, email: 'officer@manual.test.edu' });
  const beta = await createCollegeWithMembers('beta');
  return { college, head, officer, beta };
}

async function registerPending(overrides) {
  const agent = request.agent(app);
  const res = await agent.post('/api/v1/auth/register').send(registration(overrides));
  return { agent, res };
}

describe('manual_approval registration', () => {
  it('accepts any email with a valid join code and creates a pending student', async () => {
    await setup();
    const { res } = await registerPending();

    expect(res.status).toBe(201);
    expect(res.body.user).toMatchObject({ email: 'kiran.student@gmail.com', status: 'pending_approval', role: 'student' });
    const stored = await User.findOne({ email: 'kiran.student@gmail.com' }).lean();
    expect(stored.status).toBe('pending_approval');
  });

  it('still requires the join code and college code', async () => {
    await setup();
    expect((await registerPending({ joinCode: 'WRONGCODE1' })).res.body.error.code).toBe('REGISTRATION_REJECTED');
    expect((await registerPending({ collegeCode: 'nope' })).res.body.error.code).toBe('REGISTRATION_REJECTED');
  });

  it('email_domain mode still rejects a wrong domain', async () => {
    await setup();
    const res = await request(app)
      .post('/api/v1/auth/register')
      .send(registration({ collegeCode: 'beta', email: 'someone@gmail.com' }));

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('REGISTRATION_REJECTED');
  });

  it('notifies all active staff with a template that contains no email or name', async () => {
    const { head, officer } = await setup();
    await registerPending();

    const sent = await Notification.find({ type: 'student_pending' }).lean();
    expect(sent.map((item) => String(item.userId)).sort()).toEqual([String(head._id), String(officer._id)].sort());
    for (const item of sent) {
      expect(item.title).toBe('New student awaiting approval');
      expect(`${item.title} ${item.body} ${item.link}`).not.toMatch(/kiran|gmail|@/i);
      expect(item.link).toBe('/staff/students');
    }
  });
});

describe('pending accounts', () => {
  it('can sign in and read /auth/me but get 403 ACCOUNT_PENDING_APPROVAL everywhere else', async () => {
    await setup();
    await registerPending();
    const agent = await loginAgent(app, 'kiran.student@gmail.com', STUDENT_PASSWORD);

    const me = await agent.get('/api/v1/auth/me');
    expect(me.status).toBe(200);
    expect(me.body.user.status).toBe('pending_approval');

    for (const path of ['/api/v1/cases/mine', '/api/v1/lookup?q=example.com', '/api/v1/advisories', '/api/v1/notifications']) {
      const res = await agent.get(path);
      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('ACCOUNT_PENDING_APPROVAL');
    }
    expect((await agent.post('/api/v1/auth/logout')).status).toBe(204);
  });

  it('approve gives full access; reject ends the session and login returns 401', async () => {
    const { officer } = await setup();
    const { agent: first } = await registerPending();
    const { agent: second } = await registerPending({ email: 'second@yahoo.com', name: 'Second Student' });
    const staff = await loginAgent(app, officer.email, TEST_PASSWORD);
    const firstId = String((await User.findOne({ email: 'kiran.student@gmail.com' }))._id);
    const secondId = String((await User.findOne({ email: 'second@yahoo.com' }))._id);

    const approved = await staff.post(`/api/v1/staff/students/${firstId}/approve`).send({});
    expect(approved.status).toBe(200);
    expect(approved.body.student.status).toBe('active');
    expect((await first.get('/api/v1/cases/mine')).status).toBe(200);

    const rejected = await staff.post(`/api/v1/staff/students/${secondId}/reject`).send({ reason: 'Not enrolled this year' });
    expect(rejected.status).toBe(200);
    expect(rejected.body.student.status).toBe('rejected');
    expect((await second.get('/api/v1/auth/me')).status).toBe(401);
    const login = await request(app).post('/api/v1/auth/login').send({ email: 'second@yahoo.com', password: STUDENT_PASSWORD });
    expect(login.status).toBe(401);
    expect(login.body.error.code).toBe('INVALID_CREDENTIALS');

    const actions = (await AuditLog.find({ action: /^student\./ }).lean()).map((entry) => entry.action).sort();
    expect(actions).toEqual(['student.approve', 'student.reject']);
    const rejectEntry = await AuditLog.findOne({ action: 'student.reject' }).lean();
    expect(JSON.stringify(rejectEntry.metadata)).not.toContain('Not enrolled');
  });

  it('bulk approve approves pending students of the own college only', async () => {
    const { head, beta } = await setup();
    await registerPending();
    await registerPending({ email: 'two@outlook.com', name: 'Two' });
    const other = await createUser({ college: beta.college, role: ROLES.STUDENT, email: 'pending@beta.test.edu', status: 'pending_approval' });
    const ids = (await User.find({ status: 'pending_approval' }).lean()).map((user) => String(user._id));
    const staff = await loginAgent(app, head.email, TEST_PASSWORD);

    const res = await staff.post('/api/v1/staff/students/bulk-approve').send({ ids });

    expect(res.status).toBe(200);
    expect(res.body.approved).toHaveLength(2);
    expect(res.body.skipped).toBe(1);
    expect((await User.findById(other._id).lean()).status).toBe('pending_approval');
    expect(await AuditLog.countDocuments({ action: 'student.approve' })).toBe(2);
  });

  it('lists students by status with search, and reports the pending count', async () => {
    const { officer } = await setup();
    await registerPending();
    await registerPending({ email: 'meera@gmail.com', name: 'Meera (x+y)' });
    const staff = await loginAgent(app, officer.email, TEST_PASSWORD);

    const pending = await staff.get('/api/v1/staff/students?status=pending_approval');
    expect(pending.status).toBe(200);
    expect(pending.body.total).toBe(2);
    expect(pending.body.pendingCount).toBe(2);
    expect(pending.body.students[0]).not.toHaveProperty('passwordHash');

    // Regex characters in q are matched literally.
    const search = await staff.get(`/api/v1/staff/students?q=${encodeURIComponent('(x+y)')}`);
    expect(search.body.students.map((student) => student.email)).toEqual(['meera@gmail.com']);
  });

  it('college B officer gets 404 for college A students; students cannot use the staff API', async () => {
    const { beta } = await setup();
    await registerPending();
    const id = String((await User.findOne({ email: 'kiran.student@gmail.com' }))._id);
    const otherOfficer = await loginAgent(app, beta.officer.email, TEST_PASSWORD);

    for (const [method, path, body] of [
      ['post', `/api/v1/staff/students/${id}/approve`, {}],
      ['post', `/api/v1/staff/students/${id}/reject`, {}],
      ['patch', `/api/v1/staff/students/${id}/status`, { status: 'disabled' }],
      ['post', `/api/v1/staff/users/${id}/reset-password`, {}],
    ]) {
      const res = await otherOfficer[method](path).send(body);
      expect(res.status).toBe(404);
    }
    expect((await otherOfficer.post('/api/v1/staff/students/bulk-approve').send({ ids: [id] })).body.approved).toEqual([]);
    expect((await User.findById(id).lean()).status).toBe('pending_approval');

    const student = await loginAgent(app, beta.student.email, TEST_PASSWORD);
    expect((await student.get('/api/v1/staff/students')).status).toBe(403);
  });
});

describe('registration consent', () => {
  it('rejects registration without acceptPolicies and stores the accepted version on success', async () => {
    await setup();
    const withoutConsent = without(registration(), 'acceptPolicies');
    const missing = await request(app).post('/api/v1/auth/register').send(withoutConsent);
    expect(missing.status).toBe(400);
    expect(missing.body.error.code).toBe('VALIDATION_ERROR');
    expect((await request(app).post('/api/v1/auth/register').send(registration({ acceptPolicies: false }))).status).toBe(400);

    const before = Date.now();
    expect((await registerPending()).res.status).toBe(201);
    const stored = await User.findOne({ email: 'kiran.student@gmail.com' }).lean();
    expect(stored.policiesVersion).toBe(POLICIES_VERSION);
    expect(stored.policiesAcceptedAt.getTime()).toBeGreaterThanOrEqual(before - 1000);
  });
});

describe('studentVerification and isDemo on colleges', () => {
  it('the super admin sets studentVerification, but isDemo is rejected by the strict schemas', async () => {
    const admin = await createSuperAdmin();
    const agent = await loginAgent(app, admin.email, TEST_PASSWORD);

    const created = await agent
      .post('/api/v1/admin/colleges')
      .send({ name: 'Gamma College', code: 'gamma', emailDomains: ['gamma.edu'], studentVerification: 'manual_approval' });
    expect(created.status).toBe(201);
    expect(created.body.college).toMatchObject({ studentVerification: 'manual_approval', isDemo: false });

    const id = created.body.college.id;
    const switched = await agent.patch(`/api/v1/admin/colleges/${id}`).send({ studentVerification: 'email_domain' });
    expect(switched.body.college.studentVerification).toBe('email_domain');

    const createDemo = await agent.post('/api/v1/admin/colleges').send({ name: 'Delta', code: 'delta', emailDomains: ['delta.edu'], isDemo: true });
    expect(createDemo.status).toBe(400);
    const patchDemo = await agent.patch(`/api/v1/admin/colleges/${id}`).send({ isDemo: true });
    expect(patchDemo.status).toBe(400);
    expect(patchDemo.body.error.code).toBe('VALIDATION_ERROR');
  });
});
