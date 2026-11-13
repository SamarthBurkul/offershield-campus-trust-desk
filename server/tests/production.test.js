'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const request = require('supertest');
const { useTestDatabase } = require('./helpers/db');
const { createTestApp, loginAgent } = require('./helpers/auth');
const { createCollegeWithMembers, TEST_PASSWORD } = require('./helpers/factories');
const { createApp } = require('../src/app');
const { loadConfig, resolveEnv, ConfigError, JWT_SECRET_PLACEHOLDER } = require('../src/config/env');
const { disconnectDB } = require('../src/config/db');

const db = useTestDatabase();

const without = (object, key) => Object.fromEntries(Object.entries(object).filter(([name]) => name !== key));

const PRODUCTION_ENV = {
  NODE_ENV: 'production',
  MONGODB_URI: 'mongodb://127.0.0.1:1/unused',
  JWT_SECRET: 'test-only-production-secret-0123456789abcdef',
  CLIENT_ORIGINS: 'https://desk.example.edu',
  TRUST_PROXY: '0',
};

// A fake client build, so these tests never depend on `npm run build`.
let distDir;
const ASSET = 'index-AbC123.js';
beforeAll(() => {
  distDir = fs.mkdtempSync(path.join(os.tmpdir(), 'offershield-dist-'));
  fs.mkdirSync(path.join(distDir, 'assets'));
  fs.writeFileSync(path.join(distDir, 'index.html'), '<!doctype html><html><body><div id="root"></div><script type="module" src="/assets/index-AbC123.js"></script></body></html>');
  fs.writeFileSync(path.join(distDir, 'assets', ASSET), `console.log(${JSON.stringify('offershield '.repeat(400))});`);
  fs.writeFileSync(path.join(distDir, 'favicon.svg'), '<svg xmlns="http://www.w3.org/2000/svg"/>');
});
afterAll(() => {
  fs.rmSync(distDir, { recursive: true, force: true });
});
beforeEach(() => {
  jest.spyOn(console, 'warn').mockImplementation(() => {});
  jest.spyOn(console, 'error').mockImplementation(() => {});
});

const productionApp = (extra = {}) => createApp(loadConfig({ ...PRODUCTION_ENV, ...extra }), { clientDistDir: distDir, logSink: () => {} });

describe('production: one service serving the built client', () => {
  it('serves index.html for client routes that accept HTML (SPA fallback), never cached', async () => {
    const res = await request(productionApp()).get('/student/requests').set('Accept', 'text/html');

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/text\/html/);
    expect(res.text).toContain('<div id="root"></div>');
    expect(res.headers['cache-control']).toBe('no-cache');

    const deepLink = await request(productionApp()).get('/staff/cases/6650f1a2b3c4d5e6f7a8b9c0').set('Accept', 'text/html');
    expect(deepLink.status).toBe(200);
    const root = await request(productionApp()).get('/').set('Accept', 'text/html');
    expect(root.headers['cache-control']).toBe('no-cache');
  });

  it('unknown /api routes still return the JSON 404, even for browsers', async () => {
    const res = await request(productionApp()).get('/api/v1/nope').set('Accept', 'text/html');

    expect(res.status).toBe(404);
    expect(res.headers['content-type']).toMatch(/application\/json/);
    expect(res.body).toEqual({ error: { code: 'NOT_FOUND', message: 'Route not found' } });
  });

  it('caches hashed assets for a year and compresses them for gzip clients', async () => {
    const res = await request(productionApp()).get(`/assets/${ASSET}`).set('Accept-Encoding', 'gzip');

    expect(res.status).toBe(200);
    expect(res.headers['cache-control']).toBe('public, max-age=31536000, immutable');
    expect(res.headers['content-encoding']).toBe('gzip');
  });

  it('a missing asset is a plain 404, not index.html', async () => {
    const res = await request(productionApp()).get('/assets/index-gone.js').set('Accept', 'text/html');

    expect(res.status).toBe(404);
    expect(res.text).not.toContain('id="root"');
  });

  it('sends the strict CSP and a 180-day HSTS header', async () => {
    const res = await request(productionApp()).get('/').set('Accept', 'text/html');
    const csp = res.headers['content-security-policy'];

    for (const directive of [
      "default-src 'self'",
      "script-src 'self'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob:",
      "font-src 'self' data:",
      "connect-src 'self'",
      "frame-ancestors 'none'",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ]) {
      expect(csp).toContain(directive);
    }
    expect(res.headers['strict-transport-security']).toBe('max-age=15552000; includeSubDomains');
  });

  it('does not serve the client or send HSTS outside production', async () => {
    const app = createTestApp();
    expect((await request(app).get('/student/requests').set('Accept', 'text/html')).status).toBe(404);
    expect((await request(app).get('/api/v1/health')).headers['strict-transport-security']).toBeUndefined();
  });
});

describe('production startup validation', () => {
  const keysOf = (env) => {
    try {
      loadConfig(env);
    } catch (err) {
      expect(err).toBeInstanceOf(ConfigError);
      return err;
    }
    throw new Error('expected loadConfig to throw');
  };

  it('refuses a missing MONGODB_URI, naming only the key', () => {
    const env = without(PRODUCTION_ENV, 'MONGODB_URI');
    const err = keysOf(env);
    expect(err.invalidKeys).toEqual(['MONGODB_URI']);
  });

  it('refuses the .env.example placeholder JWT_SECRET without echoing it', () => {
    const err = keysOf({ ...PRODUCTION_ENV, JWT_SECRET: JWT_SECRET_PLACEHOLDER });
    expect(err.invalidKeys).toEqual(['JWT_SECRET']);
    expect(err.message).not.toContain(JWT_SECRET_PLACEHOLDER);
  });

  it('refuses a short JWT_SECRET and a missing CLIENT_ORIGINS', () => {
    expect(keysOf({ ...PRODUCTION_ENV, JWT_SECRET: 'too-short' }).invalidKeys).toEqual(['JWT_SECRET']);
    const env = without(PRODUCTION_ENV, 'CLIENT_ORIGINS');
    expect(keysOf(env).invalidKeys).toEqual(['CLIENT_ORIGINS']);
  });

  it('npm start runs with --production, which overrides a development NODE_ENV', () => {
    expect(resolveEnv({ NODE_ENV: 'development' }, ['node', 'server.js', '--production']).NODE_ENV).toBe('production');
    expect(resolveEnv({ NODE_ENV: 'development' }, ['node', 'server.js']).NODE_ENV).toBe('development');
  });

  it('defaults TRUST_PROXY to 1 in production and 0 elsewhere', () => {
    const env = without(PRODUCTION_ENV, 'TRUST_PROXY');
    expect(loadConfig(env).trustProxy).toBe(1);
    expect(loadConfig({ NODE_ENV: 'test' }).trustProxy).toBe(0);
  });

  it('COOKIE_SECURE_OVERRIDE only relaxes Secure cookies for a plain-http base URL', () => {
    expect(loadConfig(PRODUCTION_ENV).cookieSecure).toBe(true);
    expect(loadConfig({ ...PRODUCTION_ENV, APP_BASE_URL: 'http://localhost:5000', COOKIE_SECURE_OVERRIDE: 'false' }).cookieSecure).toBe(false);
    expect(loadConfig({ ...PRODUCTION_ENV, APP_BASE_URL: 'https://desk.example.edu', COOKIE_SECURE_OVERRIDE: 'false' }).cookieSecure).toBe(true);
  });
});

describe('request logging', () => {
  it('logs one JSON line per request without the query string, and returns X-Request-Id', async () => {
    const lines = [];
    const app = createTestApp({}, { logSink: (line) => lines.push(line) });

    const res = await request(app).get('/api/v1/lookup?q=secret-value');

    expect(res.headers['x-request-id']).toMatch(/^[0-9a-f-]{36}$/);
    expect(lines).toHaveLength(1);
    const entry = JSON.parse(lines[0]);
    expect(entry).toEqual({ t: expect.any(String), requestId: res.headers['x-request-id'], method: 'GET', path: '/api/v1/lookup', status: 401, ms: expect.any(Number) });
    const everything = [...lines, ...console.warn.mock.calls.flat(), ...console.error.mock.calls.flat()].join('\n');
    expect(everything).not.toContain('secret-value');
    // The error handler logs only the request id and the code.
    expect(JSON.parse(console.warn.mock.calls[0][0])).toEqual({ t: expect.any(String), requestId: res.headers['x-request-id'], code: 'UNAUTHENTICATED' });
  });

  it('adds the user id for signed-in requests and never logs bodies or cookies', async () => {
    const alpha = await createCollegeWithMembers('alpha');
    const lines = [];
    const app = createTestApp({}, { logSink: (line) => lines.push(line) });
    const agent = await loginAgent(app, alpha.student.email, TEST_PASSWORD);

    await agent.get('/api/v1/auth/me');

    const [loginLine, meLine] = lines.map((line) => JSON.parse(line));
    expect(loginLine).not.toHaveProperty('uid');
    expect(meLine.uid).toBe(String(alpha.student._id));
    expect(lines.join('\n')).not.toMatch(new RegExp(`${TEST_PASSWORD}|os_session|${alpha.student.email}`));
  });

  it('keeps a safe incoming X-Request-Id and replaces an unsafe one', async () => {
    const app = createTestApp();
    expect((await request(app).get('/api/v1/health').set('X-Request-Id', 'render-abc12345')).headers['x-request-id']).toBe('render-abc12345');
    expect((await request(app).get('/api/v1/health').set('X-Request-Id', 'bad id <script>')).headers['x-request-id']).not.toContain('<');
  });
});

describe('GET /api/v1/health/ready', () => {
  it('is 200 while the database is connected and 503 when it is not', async () => {
    const app = createTestApp();
    const ready = await request(app).get('/api/v1/health/ready');
    expect(ready.status).toBe(200);
    expect(ready.body).toEqual({ status: 'ready', database: 'connected' });

    await disconnectDB();
    try {
      const down = await request(app).get('/api/v1/health/ready');
      expect(down.status).toBe(503);
      expect(down.body).toEqual({ status: 'unavailable', database: 'disconnected' });
    } finally {
      await db.connect();
    }
  });

  it('GET /api/v1/policies exposes the policy version and retention period', async () => {
    const res = await request(createTestApp({ RETENTION_MONTHS: '18', SUPPORT_EMAIL: 'privacy@desk.example.edu' })).get('/api/v1/policies');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ version: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/), retentionMonths: 18, supportEmail: 'privacy@desk.example.edu', googleEnabled: false, emailEnabled: true });
  });
});
