'use strict';

const request = require('supertest');
const { useTestDatabase } = require('./helpers/db');
const { createTestApp, loginAgent } = require('./helpers/auth');
const { createCollege, createUser, TEST_PASSWORD } = require('./helpers/factories');
const { ROLES } = require('../src/models/User');

useTestDatabase();

beforeEach(() => {
  jest.spyOn(console, 'warn').mockImplementation(() => {});
  // express-rate-limit reports a forwarded header it was told not to trust; expected in one test.
  jest.spyOn(console, 'error').mockImplementation(() => {});
});

// The production defaults (see config/env.js), applied explicitly.
const PRODUCTION_LIKE = {
  API_RATE_LIMIT_MAX: '300',
  API_USER_RATE_LIMIT_MAX: '600',
  AUTH_RATE_LIMIT_MAX: '10',
  AUTH_IP_RATE_LIMIT_MAX: '200',
  REGISTER_RATE_LIMIT_MAX: '60',
};

const login = (app, email, password = TEST_PASSWORD) => request(app).post('/api/v1/auth/login').send({ email, password });

async function campusStudents(count) {
  const { college, domain } = await createCollege({ code: 'campus' });
  const students = [];
  for (let i = 0; i < count; i += 1) {
    students.push(await createUser({ college, role: ROLES.STUDENT, email: `student${i}@${domain}` }));
  }
  return students;
}

describe('rate limits on a shared campus IP', () => {
  it('30 different students behind one IP can all sign in', async () => {
    const app = createTestApp(PRODUCTION_LIKE);
    const students = await campusStudents(30);

    const statuses = [];
    for (const student of students) statuses.push((await login(app, student.email)).status);

    expect(statuses).toEqual(Array(30).fill(200));
    // 30 bcrypt (cost 12) comparisons can take over 30 s while every suite runs in parallel.
  }, 120_000);

  it('the same email gets 429 on its 11th attempt while other students still sign in', async () => {
    const app = createTestApp(PRODUCTION_LIKE);
    const [target, other] = await campusStudents(2);

    for (let i = 0; i < 10; i += 1) expect((await login(app, target.email, 'WrongPassword9')).status).toBe(401);
    const limited = await login(app, target.email.toUpperCase(), 'WrongPassword9');
    expect(limited.status).toBe(429);
    expect(limited.body.error.code).toBe('RATE_LIMITED');

    expect((await login(app, other.email)).status).toBe(200);
  });

  it('an authenticated user has an own /api budget, independent of other users on the same IP', async () => {
    const app = createTestApp({ ...PRODUCTION_LIKE, API_USER_RATE_LIMIT_MAX: '5' });
    const [first, second] = await campusStudents(2);
    const a = await loginAgent(app, first.email, TEST_PASSWORD);
    const b = await loginAgent(app, second.email, TEST_PASSWORD);

    for (let i = 0; i < 5; i += 1) expect((await a.get('/api/v1/auth/me')).status).toBe(200);
    const limited = await a.get('/api/v1/auth/me');
    expect(limited.status).toBe(429);
    expect(limited.body.error.code).toBe('RATE_LIMITED');

    // Same IP, different account: unaffected. Anonymous traffic keeps its own per-IP budget too.
    for (let i = 0; i < 5; i += 1) expect((await b.get('/api/v1/auth/me')).status).toBe(200);
    expect((await request(app).get('/api/v1/health')).status).toBe(200);
  });

  it('a forged or expired session cookie is limited by IP, not by the claimed user', async () => {
    const app = createTestApp({ ...PRODUCTION_LIKE, API_RATE_LIMIT_MAX: '3' });
    const forged = 'os_session=eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ4In0.invalid-signature';

    for (let i = 0; i < 3; i += 1) expect((await request(app).get('/api/v1/health').set('Cookie', forged)).status).toBe(200);
    expect((await request(app).get('/api/v1/health').set('Cookie', forged)).status).toBe(429);
  });

  it('with TRUST_PROXY=1 the X-Forwarded-For address is the client IP', async () => {
    const app = createTestApp({ ...PRODUCTION_LIKE, TRUST_PROXY: '1', AUTH_IP_RATE_LIMIT_MAX: '2' });
    const attempt = (ip) => request(app).post('/api/v1/auth/login').set('X-Forwarded-For', ip).send({ email: `${ip}@x.edu`, password: 'x' });

    expect((await attempt('203.0.113.7')).status).toBe(401);
    expect((await attempt('203.0.113.7')).status).toBe(401);
    expect((await attempt('203.0.113.7')).status).toBe(429);
    expect((await attempt('198.51.100.20')).status).toBe(401);
  });

  it('with TRUST_PROXY=0 a client cannot dodge the limit by sending X-Forwarded-For', async () => {
    const app = createTestApp({ ...PRODUCTION_LIKE, TRUST_PROXY: '0', AUTH_IP_RATE_LIMIT_MAX: '2' });
    const attempt = (ip) => request(app).post('/api/v1/auth/login').set('X-Forwarded-For', ip).send({ email: 'a@x.edu', password: 'x' });

    expect((await attempt('203.0.113.1')).status).toBe(401);
    expect((await attempt('203.0.113.2')).status).toBe(401);
    expect((await attempt('203.0.113.3')).status).toBe(429);
  });

  it('registration has its own per-IP limit', async () => {
    const app = createTestApp({ ...PRODUCTION_LIKE, REGISTER_RATE_LIMIT_MAX: '2' });

    expect((await request(app).post('/api/v1/auth/register').send({})).status).toBe(400);
    expect((await request(app).post('/api/v1/auth/register').send({})).status).toBe(400);
    expect((await request(app).post('/api/v1/auth/register').send({})).status).toBe(429);
    // Login is a separate budget.
    expect((await login(app, 'nobody@x.edu', 'WrongPassword9')).status).toBe(401);
  });
});
