'use strict';

const request = require('supertest');
const { useTestDatabase } = require('./helpers/db');
const { createTestApp, sessionSetCookie, sessionCookie, loginAgent } = require('./helpers/auth');
const { TEST_PASSWORD, createCollege, createUser, createCollegeWithMembers } = require('./helpers/factories');
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

const NEW_PASSWORD = 'BrandNewPass99';

function registration(overrides = {}) {
  return {
    name: 'Asha Student',
    email: 'asha@alpha.test.edu',
    password: 'StudentPass123',
    collegeCode: 'alpha',
    joinCode: 'TESTJOIN42',
    year: 3,
    branch: 'COMP',
    ...overrides,
  };
}

describe('POST /auth/register', () => {
  beforeEach(async () => {
    await createCollege({ code: 'alpha' });
  });

  it('1. registers a student with an HttpOnly SameSite=Lax os_session cookie and no password hash', async () => {
    const res = await request(app).post('/api/v1/auth/register').send(registration());

    expect(res.status).toBe(201);
    const cookie = sessionSetCookie(res);
    expect(cookie).toBeDefined();
    expect(cookie).toMatch(/HttpOnly/i);
    expect(cookie).toMatch(/SameSite=Lax/i);
    expect(cookie).toMatch(/Path=\//);
    expect(cookie).toMatch(/Max-Age=28800/);
    expect(cookie).not.toMatch(/Secure/i);
    expect(res.body.user).toMatchObject({ email: 'asha@alpha.test.edu', role: 'student', year: 3, branch: 'COMP' });
    expect(JSON.stringify(res.body)).not.toMatch(/passwordHash|tokenVersion|StudentPass123|os_session/);

    const stored = await User.findOne({ email: 'asha@alpha.test.edu' }).lean();
    expect(String(stored.collegeId)).toBe(res.body.user.collegeId);
  });

  it('accepts the join code case-insensitively and normalises email, college code and branch', async () => {
    const res = await request(app)
      .post('/api/v1/auth/register')
      .send(registration({ email: ' Asha@Alpha.Test.Edu ', collegeCode: 'ALPHA', joinCode: 'testjoin42', branch: 'comp' }));

    expect(res.status).toBe(201);
    expect(res.body.user).toMatchObject({ email: 'asha@alpha.test.edu', branch: 'COMP' });
  });

  describe('2. rejects invalid college details', () => {
    it.each([
      ['wrong email domain', { email: 'asha@gmail.com' }],
      ['wrong join code', { joinCode: 'WRONGCODE1' }],
      ['unknown college code', { collegeCode: 'nowhere' }],
    ])('%s -> 400 REGISTRATION_REJECTED with a generic message', async (_label, overrides) => {
      const res = await request(app).post('/api/v1/auth/register').send(registration(overrides));

      expect(res.status).toBe(400);
      expect(res.body).toEqual({
        error: { code: 'REGISTRATION_REJECTED', message: 'Registration could not be completed. Check your college details.' },
      });
      expect(sessionSetCookie(res)).toBeUndefined();
      expect(await User.countDocuments()).toBe(0);
    });

    it('suspended college -> 400 REGISTRATION_REJECTED', async () => {
      await createCollege({ code: 'frozen', status: 'suspended' });
      const res = await request(app)
        .post('/api/v1/auth/register')
        .send(registration({ collegeCode: 'frozen', email: 'asha@frozen.test.edu' }));

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('REGISTRATION_REJECTED');
      expect(await User.countDocuments()).toBe(0);
    });

    it('branch not offered by the college -> 400 VALIDATION_ERROR', async () => {
      const res = await request(app).post('/api/v1/auth/register').send(registration({ branch: 'ASTRO' }));

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
      expect(res.body.error.message).toMatch(/branch/);
      expect(await User.countDocuments()).toBe(0);
    });

    it('weak password -> 400 VALIDATION_ERROR', async () => {
      const res = await request(app).post('/api/v1/auth/register').send(registration({ password: 'onlyletters' }));

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
      expect(res.body.error.message).not.toContain('onlyletters');
    });
  });

  it.each([
    ['role', { role: 'super_admin' }],
    ['collegeId', { collegeId: '507f1f77bcf86cd799439011' }],
  ])('3. rejects the extra key %s with 400 VALIDATION_ERROR and creates no user', async (_key, extra) => {
    const res = await request(app).post('/api/v1/auth/register').send(registration(extra));

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(await User.countDocuments()).toBe(0);
  });

  it('4. returns 409 EMAIL_TAKEN for a duplicate email', async () => {
    expect((await request(app).post('/api/v1/auth/register').send(registration())).status).toBe(201);
    const res = await request(app).post('/api/v1/auth/register').send(registration({ name: 'Someone Else' }));

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('EMAIL_TAKEN');
    expect(await User.countDocuments()).toBe(1);
  });
});

describe('POST /auth/login', () => {
  let alpha;
  beforeEach(async () => {
    alpha = await createCollegeWithMembers('alpha');
  });

  it('5a. logs in, sets the cookie, returns the safe user and updates lastLoginAt', async () => {
    const res = await request(app).post('/api/v1/auth/login').send({ email: 'head@alpha.test.edu', password: TEST_PASSWORD });

    expect(res.status).toBe(200);
    expect(sessionSetCookie(res)).toMatch(/HttpOnly/i);
    expect(res.body.user).toMatchObject({ email: 'head@alpha.test.edu', role: 'tpo_head', year: null, branch: null });
    expect(res.body.user).not.toHaveProperty('passwordHash');
    expect(res.body.user).not.toHaveProperty('tokenVersion');
    const stored = await User.findById(alpha.head._id).lean();
    expect(stored.lastLoginAt).toBeInstanceOf(Date);
  });

  it('5b. returns an identical 401 body for a wrong password and an unknown email', async () => {
    const wrong = await request(app).post('/api/v1/auth/login').send({ email: 'head@alpha.test.edu', password: 'WrongPass123' });
    const unknown = await request(app).post('/api/v1/auth/login').send({ email: 'ghost@alpha.test.edu', password: 'WrongPass123' });

    expect(wrong.status).toBe(401);
    expect(unknown.status).toBe(401);
    expect(wrong.body).toEqual({ error: { code: 'INVALID_CREDENTIALS', message: 'Invalid email or password' } });
    expect(unknown.body).toEqual(wrong.body);
    expect(sessionSetCookie(wrong)).toBeUndefined();
  });

  it('5c. returns the same 401 for a disabled user with the correct password', async () => {
    await User.updateOne({ _id: alpha.officer._id }, { status: 'disabled' });
    const res = await request(app).post('/api/v1/auth/login').send({ email: 'officer@alpha.test.edu', password: TEST_PASSWORD });

    expect(res.status).toBe(401);
    expect(res.body).toEqual({ error: { code: 'INVALID_CREDENTIALS', message: 'Invalid email or password' } });
  });

  it('5d. returns the same 401 when the college is suspended', async () => {
    await alpha.college.updateOne({ status: 'suspended' });
    const res = await request(app).post('/api/v1/auth/login').send({ email: 'student@alpha.test.edu', password: TEST_PASSWORD });

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('INVALID_CREDENTIALS');
  });
});

describe('GET /auth/me', () => {
  beforeEach(async () => {
    await createCollegeWithMembers('alpha');
  });

  it('6a. returns 401 UNAUTHENTICATED without a cookie', async () => {
    const res = await request(app).get('/api/v1/auth/me');

    expect(res.status).toBe(401);
    expect(res.body).toEqual({ error: { code: 'UNAUTHENTICATED', message: 'Authentication required' } });
  });

  it('6b. returns 401 for a tampered token', async () => {
    const login = await request(app).post('/api/v1/auth/login').send({ email: 'student@alpha.test.edu', password: TEST_PASSWORD });
    const [name, token] = sessionCookie(login).split('=');
    const [header, payload, signature] = token.split('.');
    const forgedPayload = Buffer.from(
      JSON.stringify({ ...JSON.parse(Buffer.from(payload, 'base64url').toString()), role: 'super_admin' }),
    ).toString('base64url');

    const forged = await request(app).get('/api/v1/auth/me').set('Cookie', `${name}=${header}.${forgedPayload}.${signature}`);
    const garbage = await request(app).get('/api/v1/auth/me').set('Cookie', `${name}=not-a-jwt`);

    expect(forged.status).toBe(401);
    expect(garbage.status).toBe(401);
  });

  it('returns 401 for a token signed with another secret', async () => {
    const otherApp = createTestApp({ JWT_SECRET: 'a-completely-different-secret-for-this-test-only' });
    const login = await request(otherApp).post('/api/v1/auth/login').send({ email: 'student@alpha.test.edu', password: TEST_PASSWORD });

    const res = await request(app).get('/api/v1/auth/me').set('Cookie', sessionCookie(login));

    expect(res.status).toBe(401);
  });

  it('returns the safe user and a college summary', async () => {
    const agent = await loginAgent(app, 'student@alpha.test.edu', TEST_PASSWORD);
    const res = await agent.get('/api/v1/auth/me');

    expect(res.status).toBe(200);
    expect(res.body.user).toMatchObject({ email: 'student@alpha.test.edu', role: 'student' });
    expect(res.body.college).toEqual({ id: expect.any(String), name: 'alpha College', code: 'alpha', branches: expect.any(Array) });
  });
});

describe('POST /auth/logout', () => {
  it('7. clears the session cookie and returns 204', async () => {
    await createCollegeWithMembers('alpha');
    const agent = await loginAgent(app, 'student@alpha.test.edu', TEST_PASSWORD);

    const res = await agent.post('/api/v1/auth/logout');

    expect(res.status).toBe(204);
    const cleared = sessionSetCookie(res);
    expect(cleared).toMatch(/^os_session=;/);
    expect(cleared).toMatch(/Expires=Thu, 01 Jan 1970/);
    expect((await agent.get('/api/v1/auth/me')).status).toBe(401);
  });
});

describe('POST /auth/change-password', () => {
  let alpha;
  beforeEach(async () => {
    alpha = await createCollegeWithMembers('alpha');
  });

  it('8. rejects the old cookie afterwards, accepts the new cookie and writes an audit entry', async () => {
    const login = await request(app).post('/api/v1/auth/login').send({ email: 'officer@alpha.test.edu', password: TEST_PASSWORD });
    const oldCookie = sessionCookie(login);

    const res = await request(app)
      .post('/api/v1/auth/change-password')
      .set('Cookie', oldCookie)
      .send({ currentPassword: TEST_PASSWORD, newPassword: NEW_PASSWORD });

    expect(res.status).toBe(200);
    const newCookie = sessionCookie(res);
    expect(newCookie).toBeDefined();
    expect(newCookie).not.toBe(oldCookie);
    expect((await request(app).get('/api/v1/auth/me').set('Cookie', oldCookie)).status).toBe(401);
    expect((await request(app).get('/api/v1/auth/me').set('Cookie', newCookie)).status).toBe(200);

    const entry = await AuditLog.findOne({ action: 'auth.password_change' }).lean();
    expect(entry).toMatchObject({ actorRole: 'placement_officer' });
    expect(String(entry.collegeId)).toBe(String(alpha.college._id));
    expect(String(entry.entityId)).toBe(String(alpha.officer._id));
    expect(JSON.stringify(entry.metadata)).not.toMatch(new RegExp(`${TEST_PASSWORD}|${NEW_PASSWORD}`));

    const relogin = await request(app).post('/api/v1/auth/login').send({ email: 'officer@alpha.test.edu', password: NEW_PASSWORD });
    expect(relogin.status).toBe(200);
  });

  it('rejects a wrong current password with 400 INVALID_CURRENT_PASSWORD', async () => {
    const agent = await loginAgent(app, 'officer@alpha.test.edu', TEST_PASSWORD);
    const res = await agent.post('/api/v1/auth/change-password').send({ currentPassword: 'NotMyPass123', newPassword: NEW_PASSWORD });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('INVALID_CURRENT_PASSWORD');
  });

  it('9. a mustChangePassword user gets 403 PASSWORD_CHANGE_REQUIRED elsewhere but can use /auth/me and change the password', async () => {
    await createUser({ college: alpha.college, role: ROLES.TPO_HEAD, email: 'newhead@alpha.test.edu', mustChangePassword: true });
    const agent = await loginAgent(app, 'newhead@alpha.test.edu', TEST_PASSWORD);

    const blocked = await agent.get('/api/v1/staff/members');
    expect(blocked.status).toBe(403);
    expect(blocked.body.error.code).toBe('PASSWORD_CHANGE_REQUIRED');
    expect((await agent.get('/api/v1/college/me')).body.error.code).toBe('PASSWORD_CHANGE_REQUIRED');

    const me = await agent.get('/api/v1/auth/me');
    expect(me.status).toBe(200);
    expect(me.body.user.mustChangePassword).toBe(true);

    const changed = await agent.post('/api/v1/auth/change-password').send({ currentPassword: TEST_PASSWORD, newPassword: NEW_PASSWORD });
    expect(changed.status).toBe(200);
    expect(changed.body.user.mustChangePassword).toBe(false);

    // The agent now carries the new cookie issued by change-password.
    expect((await agent.get('/api/v1/staff/members')).status).toBe(200);
  });
});

describe('auth rate limiter', () => {
  it('10. returns 429 RATE_LIMITED after the configured maximum', async () => {
    const limitedApp = createTestApp({ AUTH_RATE_LIMIT_MAX: '3' });
    const attempt = () => request(limitedApp).post('/api/v1/auth/login').send({ email: 'x@y.edu', password: 'Whatever123' });

    for (let i = 0; i < 3; i += 1) expect((await attempt()).status).toBe(401);
    const limited = await attempt();

    expect(limited.status).toBe(429);
    expect(limited.body).toEqual({ error: { code: 'RATE_LIMITED', message: 'Too many attempts, please try again later' } });
    // Registration shares the strict limiter.
    expect((await request(limitedApp).post('/api/v1/auth/register').send({})).status).toBe(429);
  });
});
