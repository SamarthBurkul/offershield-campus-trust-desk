'use strict';

const request = require('supertest');
const { generateKeyPairSync } = require('node:crypto');
const { useTestDatabase } = require('./helpers/db');
const { createTestApp, loginAgent } = require('./helpers/auth');
const { createCollege, createCollegeWithMembers, createUser, TEST_PASSWORD } = require('./helpers/factories');
const { GOOGLE_TEST_ENV, signIdToken, mockGoogleFetch, cookieFrom, startGoogle } = require('./helpers/google');
const { User, ROLES } = require('../src/models/User');
const { College } = require('../src/models/College');
const { AuditLog } = require('../src/models/AuditLog');
const { Notification } = require('../src/models/Notification');
const email = require('../src/services/email');

useTestDatabase();

let app;
beforeAll(() => {
  app = createTestApp(GOOGLE_TEST_ENV);
});
beforeEach(() => {
  jest.spyOn(console, 'error').mockImplementation(() => {});
  jest.spyOn(console, 'warn').mockImplementation(() => {});
});
afterEach(() => {
  jest.restoreAllMocks();
});

const hasSession = (res) => (res.headers['set-cookie'] || []).some((c) => c.startsWith('os_session=') && !c.startsWith('os_session=;'));

/** Full start → callback round trip with the mocked Google endpoints. */
async function signInWithGoogle({ claims = {}, intent = 'register', agent = request.agent(app), tokenStatus, idToken } = {}) {
  const { state } = await startGoogle(agent, intent);
  mockGoogleFetch({ claims, tokenStatus, idToken });
  const res = await agent.get(`/api/v1/auth/google/callback?code=test-auth-code&state=${state}&scope=openid`);
  return { res, agent };
}

const complete = (agent, overrides = {}) =>
  agent.post('/api/v1/auth/google/complete').send({ collegeCode: 'alpha', joinCode: 'TESTJOIN42', year: 2, branch: 'COMP', acceptPolicies: true, ...overrides });

describe('GET /auth/google/start (G2)', () => {
  test('redirects to Google with state, nonce, PKCE S256 and a signed httpOnly SameSite=Lax cookie', async () => {
    const res = await request(app).get('/api/v1/auth/google/start?intent=login');
    expect(res.status).toBe(302);
    const location = new URL(res.headers.location);
    expect(location.origin + location.pathname).toBe('https://accounts.google.com/o/oauth2/v2/auth');
    const params = location.searchParams;
    expect(params.get('client_id')).toBe(GOOGLE_TEST_ENV.GOOGLE_CLIENT_ID);
    expect(params.get('redirect_uri')).toBe('http://localhost:5173/api/v1/auth/google/callback');
    expect(params.get('response_type')).toBe('code');
    expect(params.get('scope')).toBe('openid email profile');
    expect(params.get('prompt')).toBe('select_account');
    expect(params.get('access_type')).toBe('online');
    expect(params.get('code_challenge_method')).toBe('S256');
    expect(params.get('code_challenge')).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(Buffer.from(params.get('state'), 'base64url')).toHaveLength(32);
    expect(params.get('nonce')).toBeTruthy();

    const cookie = res.headers['set-cookie'].find((c) => c.startsWith('os_oauth='));
    expect(cookie).toMatch(/HttpOnly/i);
    expect(cookie).toMatch(/SameSite=Lax/i);
    expect(cookie).toMatch(/Path=\/api\/v1\/auth\/google/);
    expect(cookie).toMatch(/Max-Age=600/);
    // The cookie is signed, not a raw value: the state is inside, the verifier never appears in the URL.
    expect(res.headers.location).not.toContain(cookie.split('=')[1].split('.')[1]);
  });

  test('rejects an unknown intent or extra parameters (no redirect target can be injected)', async () => {
    expect((await request(app).get('/api/v1/auth/google/start?intent=admin')).status).toBe(400);
    expect((await request(app).get('/api/v1/auth/google/start?intent=login&next=https://evil.example')).status).toBe(400);
  });

  test('all Google routes are 404 when Google is not configured, and /policies says so', async () => {
    const plain = createTestApp();
    expect((await request(plain).get('/api/v1/auth/google/start')).status).toBe(404);
    expect((await request(plain).get('/api/v1/auth/google/callback?code=x&state=y')).status).toBe(404);
    expect((await request(plain).get('/api/v1/policies')).body.googleEnabled).toBe(false);
    expect((await request(app).get('/api/v1/policies')).body.googleEnabled).toBe(true);
  });
});

describe('GET /auth/google/callback rejections (G3)', () => {
  beforeEach(async () => {
    await createCollegeWithMembers('alpha');
  });

  const expectFailed = (res) => {
    expect(res.status).toBe(302);
    expect(res.headers.location).toBe('/login?error=google_failed');
    expect(hasSession(res)).toBe(false);
  };

  test('state mismatch, missing cookie and a Google error never exchange the code', async () => {
    const agent = request.agent(app);
    await startGoogle(agent);
    const fetchMock = mockGoogleFetch();
    expectFailed(await agent.get('/api/v1/auth/google/callback?code=c&state=wrong-state'));
    expectFailed(await request(app).get('/api/v1/auth/google/callback?code=c&state=anything'));
    const { state } = await startGoogle(agent);
    expectFailed(await agent.get(`/api/v1/auth/google/callback?error=access_denied&state=${state}`));
    expect(fetchMock).not.toHaveBeenCalled();
  });

  test('the state cookie is single-use (cleared on callback)', async () => {
    const agent = request.agent(app);
    const { state } = await startGoogle(agent);
    mockGoogleFetch({ claims: { email: 'student@alpha.test.edu', sub: 'sub-once' } });
    const first = await agent.get(`/api/v1/auth/google/callback?code=c&state=${state}`);
    expect(first.headers.location).toBe('/student');
    expect(first.headers['set-cookie'].some((c) => c.startsWith('os_oauth=;'))).toBe(true);
    expectFailed(await agent.get(`/api/v1/auth/google/callback?code=c&state=${state}`));
  });

  test('a tampered state cookie is rejected', async () => {
    const agent = request.agent(app);
    const { res, state } = await startGoogle(agent);
    const raw = cookieFrom(res, 'os_oauth');
    const tampered = `${raw.slice(0, -2)}xx`;
    mockGoogleFetch();
    expectFailed(await request(app).get(`/api/v1/auth/google/callback?code=c&state=${state}`).set('Cookie', tampered));
  });

  test.each([
    ['wrong issuer', { iss: 'https://evil.example.com' }],
    ['wrong audience', { aud: 'someone-else.apps.googleusercontent.com' }],
    ['expired', { exp: Math.floor(Date.now() / 1000) - 3600 }],
    ['wrong nonce', { nonce: 'not-the-nonce' }],
    ['unverified email', { email_verified: false }],
    ['email_verified as a string', { email_verified: 'true' }],
  ])('rejects an ID token with %s', async (_label, claims) => {
    const { res } = await signInWithGoogle({ claims: { email: 'student@alpha.test.edu', ...claims } });
    expectFailed(res);
  });

  test('rejects a token signed by another key, an unsigned token and a token-endpoint error', async () => {
    const { privateKey: otherKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
    const agent = request.agent(app);
    let { state } = await startGoogle(agent);
    mockGoogleFetch({ idToken: signIdToken({ nonce: mockGoogleFetch.lastNonce }, { key: otherKey }) });
    expectFailed(await agent.get(`/api/v1/auth/google/callback?code=c&state=${state}`));

    ({ state } = await startGoogle(agent));
    const unsigned = `${Buffer.from(JSON.stringify({ alg: 'none' })).toString('base64url')}.${Buffer.from('{}').toString('base64url')}.`;
    mockGoogleFetch({ idToken: unsigned });
    expectFailed(await agent.get(`/api/v1/auth/google/callback?code=c&state=${state}`));

    const { res } = await signInWithGoogle({ tokenStatus: 400 });
    expectFailed(res);
  });

  test('the code exchange sends the PKCE verifier and calls only the fixed Google endpoints', async () => {
    const agent = request.agent(app);
    const { state, location } = await startGoogle(agent);
    const fetchMock = mockGoogleFetch({ claims: { email: 'student@alpha.test.edu', sub: 'sub-pkce' } });
    await agent.get(`/api/v1/auth/google/callback?code=the-code&state=${state}`);
    const urls = fetchMock.calls.map((call) => call.url);
    expect(new Set(urls)).toEqual(new Set(['https://oauth2.googleapis.com/token', 'https://www.googleapis.com/oauth2/v3/certs']));
    const form = new URLSearchParams(fetchMock.calls.find((call) => call.url.endsWith('/token')).init.body);
    expect(form.get('grant_type')).toBe('authorization_code');
    expect(form.get('code')).toBe('the-code');
    const { createHash } = require('node:crypto');
    expect(createHash('sha256').update(form.get('code_verifier')).digest('base64url')).toBe(location.searchParams.get('code_challenge'));
  });

  test('failures log a code only, never the authorization code or a token', async () => {
    const { res } = await signInWithGoogle({ claims: { aud: 'other' } });
    expectFailed(res);
    const logged = console.error.mock.calls.flat().join(' ');
    expect(logged).toContain('AUDIENCE');
    expect(logged).not.toContain('test-auth-code');
    expect(logged).not.toMatch(/eyJ/);
  });
});

describe('callback acceptances and account linking (G4)', () => {
  test('links an existing password account by verified email, audits it and signs in', async () => {
    const { student } = await createCollegeWithMembers('alpha');
    await User.updateOne({ _id: student._id }, { $set: { emailVerifiedAt: null } });
    const { res, agent } = await signInWithGoogle({ claims: { email: 'Student@Alpha.Test.Edu', sub: 'sub-link' } });
    expect(res.headers.location).toBe('/student');
    expect(hasSession(res)).toBe(true);
    const linked = await User.findById(student._id).lean();
    expect(linked.googleSub).toBe('sub-link');
    expect(linked.authMethods.sort()).toEqual(['google', 'password']);
    expect(linked.emailVerifiedAt).toBeInstanceOf(Date);
    const entry = await AuditLog.findOne({ action: 'auth.google_linked' }).lean();
    expect(entry.entityId.toString()).toBe(student._id.toString());
    expect(JSON.stringify(entry.metadata)).not.toMatch(/sub-link|code/);
    const me = await agent.get('/api/v1/auth/me');
    expect(me.body.user).toMatchObject({ email: 'student@alpha.test.edu', emailVerified: true });
    // Password sign-in keeps working for a linked account.
    expect((await request(app).post('/api/v1/auth/login').send({ email: 'student@alpha.test.edu', password: TEST_PASSWORD })).status).toBe(200);
  });

  test('a known googleSub signs in even after the email changed; staff go to /staff', async () => {
    const { college, head } = await createCollegeWithMembers('alpha');
    await User.updateOne({ _id: head._id }, { $set: { googleSub: 'sub-head' } });
    const { res } = await signInWithGoogle({ claims: { email: 'head.personal@gmail.com', sub: 'sub-head' }, intent: 'login' });
    expect(res.headers.location).toBe('/staff');
    expect(hasSession(res)).toBe(true);
    expect(college).toBeTruthy();
  });

  test('disabled and rejected accounts get account_unavailable; a suspended college gets the generic failure', async () => {
    const { college, student, officer } = await createCollegeWithMembers('alpha');
    await User.updateOne({ _id: student._id }, { $set: { status: 'disabled' } });
    await User.updateOne({ _id: officer._id }, { $set: { status: 'rejected' } });
    for (const address of ['student@alpha.test.edu', 'officer@alpha.test.edu']) {
      const { res } = await signInWithGoogle({ claims: { email: address, sub: `sub-${address}` } });
      expect(res.headers.location).toBe('/login?error=account_unavailable');
      expect(hasSession(res)).toBe(false);
    }
    await College.updateOne({ _id: college._id }, { $set: { status: 'suspended' } });
    const { res } = await signInWithGoogle({ claims: { email: 'head@alpha.test.edu', sub: 'sub-head' } });
    expect(res.headers.location).toBe('/login?error=google_failed');
    expect(hasSession(res)).toBe(false);
  });

  test('a pending student gets a session and the pending page', async () => {
    const { college } = await createCollege({ code: 'alpha', studentVerification: 'manual_approval' });
    await createUser({ college, role: ROLES.STUDENT, email: 'waiting@gmail.com', status: 'pending_approval' });
    const { res, agent } = await signInWithGoogle({ claims: { email: 'waiting@gmail.com', sub: 'sub-wait' } });
    expect(res.headers.location).toBe('/pending-approval');
    expect((await agent.get('/api/v1/auth/me')).body.user.status).toBe('pending_approval');
    expect((await agent.get('/api/v1/cases')).body.error.code).toBe('ACCOUNT_PENDING_APPROVAL');
  });

  test('an account already linked to another Google account is not taken over', async () => {
    const { student } = await createCollegeWithMembers('alpha');
    await User.updateOne({ _id: student._id }, { $set: { googleSub: 'sub-original' } });
    const { res } = await signInWithGoogle({ claims: { email: 'student@alpha.test.edu', sub: 'sub-attacker' } });
    expect(res.headers.location).toBe('/login?error=google_failed');
    expect((await User.findById(student._id).lean()).googleSub).toBe('sub-original');
  });
});

describe('Google registration (G5)', () => {
  beforeEach(async () => {
    await createCollegeWithMembers('alpha');
  });

  test('an unknown Google account is sent to /register/google with a signed pending cookie', async () => {
    const { res, agent } = await signInWithGoogle({ claims: { email: 'new.student@alpha.test.edu', sub: 'sub-new', name: 'New Student' } });
    expect(res.headers.location).toBe('/register/google');
    expect(hasSession(res)).toBe(false);
    const cookie = res.headers['set-cookie'].find((c) => c.startsWith('os_google_signup='));
    expect(cookie).toMatch(/HttpOnly/i);
    expect(cookie).toMatch(/SameSite=Lax/i);
    const pending = await agent.get('/api/v1/auth/google/pending');
    expect(pending.status).toBe(200);
    expect(pending.body).toEqual({ email: 'new.student@alpha.test.edu', name: 'New Student' });
  });

  test('intent=login without an account also goes to registration, with a notice', async () => {
    const { res } = await signInWithGoogle({ claims: { email: 'new.student@alpha.test.edu', sub: 'sub-new' }, intent: 'login' });
    expect(res.headers.location).toBe('/register/google?notice=no_account');
  });

  test('complete creates a verified Google-only student, signs in and audits auth.google_register', async () => {
    const { agent } = await signInWithGoogle({ claims: { email: 'new.student@alpha.test.edu', sub: 'sub-new' } });
    const res = await complete(agent);
    expect(res.status).toBe(201);
    expect(res.body.user).toMatchObject({ email: 'new.student@alpha.test.edu', role: 'student', status: 'active', emailVerified: true, authMethods: ['google'] });
    expect(hasSession(res)).toBe(true);
    expect(res.headers['set-cookie'].some((c) => c.startsWith('os_google_signup=;'))).toBe(true);
    const user = await User.findOne({ email: 'new.student@alpha.test.edu' }).select('+passwordHash').lean();
    expect(user.passwordHash).toBeNull();
    expect(user.googleSub).toBe('sub-new');
    expect(user.policiesAcceptedAt).toBeInstanceOf(Date);
    expect(await AuditLog.countDocuments({ action: 'auth.google_register' })).toBe(1);
    expect((await agent.get('/api/v1/notifications')).status).toBe(200);
    // The pending cookie is gone: completing again is refused.
    expect((await complete(agent)).status).toBe(401);
  });

  test('email_domain colleges require the Google address domain (or hd) to match', async () => {
    let { agent } = await signInWithGoogle({ claims: { email: 'someone@gmail.com', sub: 'sub-gmail' } });
    let res = await complete(agent);
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('REGISTRATION_REJECTED');

    ({ agent } = await signInWithGoogle({ claims: { email: 'someone@mail.alpha-alias.edu', sub: 'sub-hd', hd: 'alpha.test.edu' } }));
    res = await complete(agent);
    expect(res.status).toBe(201);
  });

  test('wrong join code, unknown branch and missing consent are rejected', async () => {
    const { agent } = await signInWithGoogle({ claims: { email: 'new.student@alpha.test.edu', sub: 'sub-new' } });
    expect((await complete(agent, { joinCode: 'WRONGCODE1' })).body.error.code).toBe('REGISTRATION_REJECTED');
    expect((await complete(agent, { branch: 'NOPE' })).status).toBe(400);
    expect((await complete(agent, { acceptPolicies: false })).status).toBe(400);
    expect((await complete(agent, { email: 'other@alpha.test.edu' })).status).toBe(400);
  });

  test('manual_approval colleges create a pending student and notify staff', async () => {
    const { college } = await createCollege({ code: 'manual', studentVerification: 'manual_approval' });
    await createUser({ college, role: ROLES.TPO_HEAD, email: 'head@manual.test.edu' });
    const { agent } = await signInWithGoogle({ claims: { email: 'anyone@gmail.com', sub: 'sub-manual' } });
    const res = await complete(agent, { collegeCode: 'manual' });
    expect(res.status).toBe(201);
    expect(res.body.user.status).toBe('pending_approval');
    expect(await Notification.countDocuments({ type: 'student_pending' })).toBe(1);
  });

  test('pending/complete without a valid signup cookie are refused', async () => {
    expect((await request(app).get('/api/v1/auth/google/pending')).status).toBe(401);
    expect((await complete(request(app))).status).toBe(401);
  });
});

describe('no open redirect (G6)', () => {
  test('every callback outcome redirects to a fixed internal path', async () => {
    await createCollegeWithMembers('alpha');
    const outcomes = [];
    for (const claims of [{ email: 'student@alpha.test.edu', sub: 's1' }, { email: 'brand.new@alpha.test.edu', sub: 's2' }, { aud: 'x' }]) {
      const { res } = await signInWithGoogle({ claims });
      outcomes.push(res.headers.location);
    }
    const agent = request.agent(app);
    const { state } = await startGoogle(agent);
    mockGoogleFetch({ claims: { email: 'student@alpha.test.edu', sub: 's1' } });
    const injected = await agent.get(`/api/v1/auth/google/callback?code=c&state=${state}&redirect=https://evil.example&next=//evil.example`);
    outcomes.push(injected.headers.location);
    for (const location of outcomes) {
      expect(location).toMatch(/^\/(?!\/)/);
      expect(['/student', '/register/google', '/login?error=google_failed']).toContain(location);
    }
  });
});

describe('Google-only accounts (G7)', () => {
  let agent;
  beforeEach(async () => {
    await createCollegeWithMembers('alpha');
    ({ agent } = await signInWithGoogle({ claims: { email: 'gonly@alpha.test.edu', sub: 'sub-gonly' } }));
    expect((await complete(agent)).status).toBe(201);
  });

  test('password sign-in fails with the generic 401', async () => {
    const res = await request(app).post('/api/v1/auth/login').send({ email: 'gonly@alpha.test.edu', password: TEST_PASSWORD });
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('INVALID_CREDENTIALS');
  });

  test('change-password is refused (no password to change)', async () => {
    const res = await agent.post('/api/v1/auth/change-password').send({ currentPassword: 'anything-1', newPassword: 'NewPassw0rd-22' });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('PASSWORD_NOT_SET');
  });

  test('forgot-password sends the "use Continue with Google" email instead of a link', async () => {
    const provider = email.getProvider();
    provider.outbox.length = 0;
    const res = await request(app).post('/api/v1/auth/forgot-password').send({ email: 'gonly@alpha.test.edu' });
    expect(res.status).toBe(202);
    await email.flushEmails();
    expect(provider.outbox).toHaveLength(1);
    expect(provider.outbox[0].subject).toBe('Sign in to OfferShield with Google');
    expect(provider.outbox[0].text).not.toMatch(/reset-password/);
  });

  test('a staff-assisted reset adds password sign-in', async () => {
    const head = await loginAgent(app, 'head@alpha.test.edu', TEST_PASSWORD);
    const student = await User.findOne({ email: 'gonly@alpha.test.edu' }).lean();
    const res = await head.post(`/api/v1/staff/users/${student._id}/reset-password`).send({});
    expect(res.status).toBe(200);
    const updated = await User.findById(student._id).lean();
    expect(updated.authMethods.sort()).toEqual(['google', 'password']);
    expect(updated.mustChangePassword).toBe(true);
  });
});
