'use strict';

const { useTestDatabase } = require('./helpers/db');
const { createTestApp, loginAgent } = require('./helpers/auth');
const { TEST_PASSWORD, createCollegeWithMembers, createSuperAdmin } = require('./helpers/factories');

useTestDatabase();

let app;
beforeAll(() => {
  app = createTestApp();
});
beforeEach(async () => {
  jest.spyOn(console, 'warn').mockImplementation(() => {});
  await createCollegeWithMembers('alpha');
  await createSuperAdmin();
});

const FORBIDDEN = { error: { code: 'FORBIDDEN', message: expect.any(String) } };
const as = (email) => loginAgent(app, email, TEST_PASSWORD);

describe('role-based access control', () => {
  it('11. student gets 403 on /staff/members and /admin/colleges', async () => {
    const student = await as('student@alpha.test.edu');

    const staff = await student.get('/api/v1/staff/members');
    const admin = await student.get('/api/v1/admin/colleges');

    expect(staff.status).toBe(403);
    expect(staff.body).toEqual(FORBIDDEN);
    expect(admin.status).toBe(403);
    expect(admin.body).toEqual(FORBIDDEN);
    expect((await student.post('/api/v1/staff/officers').send({ name: 'X', email: 'x@alpha.test.edu' })).status).toBe(403);
  });

  it('12. placement_officer gets 403 on POST /staff/officers and /admin/colleges', async () => {
    const officer = await as('officer@alpha.test.edu');

    const create = await officer.post('/api/v1/staff/officers').send({ name: 'New Officer', email: 'new@alpha.test.edu' });
    const admin = await officer.get('/api/v1/admin/colleges');

    expect(create.status).toBe(403);
    expect(create.body).toEqual(FORBIDDEN);
    expect(admin.status).toBe(403);
    // Officers may read the staff list of their own college.
    expect((await officer.get('/api/v1/staff/members')).status).toBe(200);
  });

  it('13. tpo_head gets 403 on /admin/colleges', async () => {
    const head = await as('head@alpha.test.edu');

    const list = await head.get('/api/v1/admin/colleges');
    const create = await head.post('/api/v1/admin/colleges').send({ name: 'X', code: 'xcol', emailDomains: ['x.edu'] });

    expect(list.status).toBe(403);
    expect(list.body).toEqual(FORBIDDEN);
    expect(create.status).toBe(403);
  });

  it('14. super_admin gets 403 on /staff/members and /college/me', async () => {
    const root = await as('root@platform.test');

    const staff = await root.get('/api/v1/staff/members');
    const college = await root.get('/api/v1/college/me');

    expect(staff.status).toBe(403);
    expect(staff.body).toEqual(FORBIDDEN);
    expect(college.status).toBe(403);
    expect(college.body).toEqual(FORBIDDEN);
    expect((await root.get('/api/v1/admin/colleges')).status).toBe(200);
  });

  it('any college user can read GET /college/me for their own college', async () => {
    const student = await as('student@alpha.test.edu');
    const res = await student.get('/api/v1/college/me');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ college: { name: 'alpha College', code: 'alpha', branches: expect.arrayContaining(['COMP']) } });
  });

  it('unauthenticated requests to protected routes get 401 before any role check', async () => {
    const request = require('supertest');
    for (const path of ['/api/v1/staff/members', '/api/v1/admin/colleges', '/api/v1/college/me']) {
      const res = await request(app).get(path);
      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('UNAUTHENTICATED');
    }
  });
});
