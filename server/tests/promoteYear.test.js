'use strict';

const { useTestDatabase } = require('./helpers/db');
const { createTestApp, loginAgent } = require('./helpers/auth');
const { createCollegeWithMembers, createUser, TEST_PASSWORD } = require('./helpers/factories');
const { User, ROLES } = require('../src/models/User');
const { AuditLog } = require('../src/models/AuditLog');

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
  const mk = (ctx, email, year, extra = {}) => createUser({ college: ctx.college, role: ROLES.STUDENT, email: `${email}@${ctx.domain}`, year, ...extra });
  await mk(alpha, 'y3a', 3);
  await mk(alpha, 'y3b', 3);
  await mk(alpha, 'y3disabled', 3, { status: 'disabled' });
  await mk(alpha, 'y3pending', 3, { status: 'pending_approval' });
  await mk(alpha, 'y4', 4);
  await mk(beta, 'y3other', 3);
});
afterEach(() => jest.restoreAllMocks());

const yearOf = async (email) => (await User.findOne({ email }).lean()).year;

describe('POST /staff/students/promote-year (G14)', () => {
  test('the TPO head promotes active students of one year in their own college only', async () => {
    const head = await loginAgent(app, 'head@alpha.test.edu', TEST_PASSWORD);
    const res = await head.post('/api/v1/staff/students/promote-year').send({ fromYear: 3 });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ promoted: 2, fromYear: 3, toYear: 4 });
    expect(await yearOf('y3a@alpha.test.edu')).toBe(4);
    expect(await yearOf('y3b@alpha.test.edu')).toBe(4);
    expect(await yearOf('y3disabled@alpha.test.edu')).toBe(3);
    expect(await yearOf('y3pending@alpha.test.edu')).toBe(3);
    expect(await yearOf('y4@alpha.test.edu')).toBe(4);
    expect(await yearOf('y3other@beta.test.edu')).toBe(3);

    const entry = await AuditLog.findOne({ action: 'student.promote_year' }).lean();
    expect(entry.metadata).toEqual({ fromYear: 3, toYear: 4, count: 2 });
    expect(String(entry.collegeId)).toBe(String(alpha.college._id));
  });

  test('year 4 → 5 is the last step; fromYear 5 or 0 is refused', async () => {
    const head = await loginAgent(app, 'head@alpha.test.edu', TEST_PASSWORD);
    expect((await head.post('/api/v1/staff/students/promote-year').send({ fromYear: 4 })).body.promoted).toBe(1);
    expect(await yearOf('y4@alpha.test.edu')).toBe(5);
    for (const fromYear of [5, 0, '3']) expect((await head.post('/api/v1/staff/students/promote-year').send({ fromYear })).status).toBe(400);
  });

  test('officers and students cannot promote', async () => {
    const officer = await loginAgent(app, 'officer@alpha.test.edu', TEST_PASSWORD);
    expect((await officer.post('/api/v1/staff/students/promote-year').send({ fromYear: 3 })).status).toBe(403);
    const student = await loginAgent(app, 'student@alpha.test.edu', TEST_PASSWORD);
    expect((await student.post('/api/v1/staff/students/promote-year').send({ fromYear: 3 })).status).toBe(403);
    expect(await yearOf('y3a@alpha.test.edu')).toBe(3);
  });
});
