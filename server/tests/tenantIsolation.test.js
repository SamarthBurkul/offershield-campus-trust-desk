'use strict';

const { useTestDatabase } = require('./helpers/db');
const { createTestApp, loginAgent } = require('./helpers/auth');
const { TEST_PASSWORD, createCollegeWithMembers } = require('./helpers/factories');
const { User } = require('../src/models/User');

useTestDatabase();

let app;
let alpha;
let beta;
beforeAll(() => {
  app = createTestApp();
});
beforeEach(async () => {
  jest.spyOn(console, 'warn').mockImplementation(() => {});
  alpha = await createCollegeWithMembers('alpha');
  beta = await createCollegeWithMembers('beta');
});

const headA = () => loginAgent(app, 'head@alpha.test.edu', TEST_PASSWORD);

describe('cross-college isolation (college A vs college B)', () => {
  it("15. head A's GET /staff/members lists only A's staff", async () => {
    const res = await (await headA()).get('/api/v1/staff/members');

    expect(res.status).toBe(200);
    const emails = res.body.staff.map((member) => member.email).sort();
    expect(emails).toEqual(['head@alpha.test.edu', 'officer@alpha.test.edu']);
    // Students are not staff; only identity, role and status are exposed.
    for (const member of res.body.staff) {
      expect(Object.keys(member).sort()).toEqual(['email', 'id', 'name', 'role', 'status']);
    }
  });

  it("16. head A changing B's officer status gets 404 and B's officer is unchanged", async () => {
    const res = await (await headA())
      .patch(`/api/v1/staff/officers/${beta.officer._id}/status`)
      .send({ status: 'disabled' });

    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: { code: 'NOT_FOUND', message: 'Staff member not found' } });
    const untouched = await User.findById(beta.officer._id).lean();
    expect(untouched.status).toBe('active');
    expect(untouched.tokenVersion).toBe(0);
  });

  it('16b. a malformed or unknown officer id also gets 404', async () => {
    const agent = await headA();
    expect((await agent.patch('/api/v1/staff/officers/not-an-id/status').send({ status: 'disabled' })).status).toBe(404);
    expect(
      (await agent.patch('/api/v1/staff/officers/507f1f77bcf86cd799439011/status').send({ status: 'disabled' })).status,
    ).toBe(404);
  });

  it("17. head A creating an officer with B's email domain gets 400 and no user is created", async () => {
    const res = await (await headA()).post('/api/v1/staff/officers').send({ name: 'Intruder', email: 'intruder@beta.test.edu' });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('EMAIL_DOMAIN_MISMATCH');
    expect(await User.exists({ email: 'intruder@beta.test.edu' })).toBeNull();
  });

  it('17b. collegeId in the body is rejected, so a user cannot be created in another college', async () => {
    const res = await (await headA())
      .post('/api/v1/staff/officers')
      .send({ name: 'Sneaky', email: 'sneaky@alpha.test.edu', collegeId: String(beta.college._id) });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  describe('18. head A cannot change a TPO head or themselves', () => {
    it('another tpo_head in the same college -> 403 FORBIDDEN', async () => {
      const { createUser } = require('./helpers/factories');
      const otherHead = await createUser({ college: alpha.college, role: 'tpo_head', email: 'head2@alpha.test.edu' });

      const res = await (await headA()).patch(`/api/v1/staff/officers/${otherHead._id}/status`).send({ status: 'disabled' });

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
      expect((await User.findById(otherHead._id).lean()).status).toBe('active');
    });

    it('self -> 400 CANNOT_MODIFY_SELF', async () => {
      const res = await (await headA()).patch(`/api/v1/staff/officers/${alpha.head._id}/status`).send({ status: 'disabled' });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('CANNOT_MODIFY_SELF');
      expect((await User.findById(alpha.head._id).lean()).status).toBe('active');
    });

    it('a student of the same college -> 404 (not an officer)', async () => {
      const res = await (await headA()).patch(`/api/v1/staff/officers/${alpha.student._id}/status`).send({ status: 'disabled' });

      expect(res.status).toBe(404);
    });
  });

  it("head A can disable and re-enable A's officer; disabling ends the officer's session", async () => {
    const officer = await loginAgent(app, 'officer@alpha.test.edu', TEST_PASSWORD);
    expect((await officer.get('/api/v1/staff/members')).status).toBe(200);
    const head = await headA();

    const disabled = await head.patch(`/api/v1/staff/officers/${alpha.officer._id}/status`).send({ status: 'disabled' });
    expect(disabled.status).toBe(200);
    expect(disabled.body.user).toMatchObject({ email: 'officer@alpha.test.edu', status: 'disabled' });
    expect((await officer.get('/api/v1/staff/members')).status).toBe(401);

    const enabled = await head.patch(`/api/v1/staff/officers/${alpha.officer._id}/status`).send({ status: 'active' });
    expect(enabled.body.user.status).toBe('active');
    // The old session stays revoked; a fresh login works.
    expect((await officer.get('/api/v1/auth/me')).status).toBe(401);
    await expect(loginAgent(app, 'officer@alpha.test.edu', TEST_PASSWORD)).resolves.toBeDefined();
  });

  it("head A's created officer belongs to college A even though nothing in the request names it", async () => {
    const res = await (await headA()).post('/api/v1/staff/officers').send({ name: 'New Officer', email: 'new.officer@alpha.test.edu' });

    expect(res.status).toBe(201);
    expect(res.body.temporaryPassword).toMatch(/^[A-Za-z0-9]{16}$/);
    const created = await User.findOne({ email: 'new.officer@alpha.test.edu' }).lean();
    expect(String(created.collegeId)).toBe(String(alpha.college._id));
    expect(created).toMatchObject({ role: 'placement_officer', mustChangePassword: true });
  });
});
