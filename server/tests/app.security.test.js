'use strict';

const request = require('supertest');
const { app } = require('../src/app');
const { loadConfig } = require('../src/config/env');

beforeEach(() => {
  // Keep expected error logging out of the test output.
  jest.spyOn(console, 'error').mockImplementation(() => {});
  jest.spyOn(console, 'warn').mockImplementation(() => {});
});

describe('body parsing errors', () => {
  it('returns 400 INVALID_JSON for a malformed JSON body without a stack trace', async () => {
    const res = await request(app)
      .post('/api/v1/health')
      .set('Content-Type', 'application/json')
      .send('{"broken": ');

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: { code: 'INVALID_JSON', message: 'Malformed JSON body' } });
    expect(res.text).not.toMatch(/stack|at .*\.js:\d+/i);
  });

  it('returns 413 PAYLOAD_TOO_LARGE for a body over 100kb', async () => {
    const res = await request(app)
      .post('/api/v1/health')
      .set('Content-Type', 'application/json')
      .send(JSON.stringify({ data: 'x'.repeat(101 * 1024) }));

    expect(res.status).toBe(413);
    expect(res.body.error.code).toBe('PAYLOAD_TOO_LARGE');
    expect(res.body.error).not.toHaveProperty('stack');
  });
});

describe('security headers', () => {
  it('sets helmet headers and hides x-powered-by', async () => {
    const res = await request(app).get('/api/v1/health');

    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['content-security-policy']).toBeDefined();
    expect(res.headers['x-powered-by']).toBeUndefined();
  });

  it('sends rate-limit headers on /api requests', async () => {
    const res = await request(app).get('/api/v1/health');

    expect(res.headers.ratelimit).toBeDefined();
  });
});

describe('CORS', () => {
  it('allows the configured client origin with credentials', async () => {
    const res = await request(app).get('/api/v1/health').set('Origin', 'http://localhost:5173');

    expect(res.status).toBe(200);
    expect(res.headers['access-control-allow-origin']).toBe('http://localhost:5173');
    expect(res.headers['access-control-allow-credentials']).toBe('true');
  });

  it('gives a disallowed origin no allow-origin header and does not error', async () => {
    const res = await request(app).get('/api/v1/health').set('Origin', 'http://evil.example');

    expect(res.status).not.toBe(500);
    expect(res.status).toBe(200);
    expect(res.headers['access-control-allow-origin']).toBeUndefined();
  });

  it('does not grant a disallowed origin on preflight', async () => {
    const res = await request(app)
      .options('/api/v1/health')
      .set('Origin', 'http://evil.example')
      .set('Access-Control-Request-Method', 'POST');

    expect(res.status).toBeLessThan(500);
    expect(res.headers['access-control-allow-origin']).toBeUndefined();
  });
});

describe('unexpected errors in production', () => {
  it('returns 500 INTERNAL_ERROR without a stack trace', async () => {
    let prodApp;
    jest.isolateModules(() => {
      // Test-only injection: make the health controller throw.
      jest.doMock('../src/controllers/health.controller', () => ({
        getHealth: () => {
          throw new Error('boom: secret internal detail');
        },
        getReady: () => {},
        createPoliciesHandler: () => () => {},
      }));
      const { createApp } = require('../src/app');
      prodApp = createApp(
        loadConfig({
          NODE_ENV: 'production',
          MONGODB_URI: 'mongodb://127.0.0.1:1/unused',
          JWT_SECRET: 'test-only-production-secret-0123456789abcdef',
          CLIENT_ORIGINS: 'https://desk.example.edu',
        }),
        { serveClient: false, logSink: () => {} },
      );
    });

    const res = await request(prodApp).get('/api/v1/health');

    expect(res.status).toBe(500);
    expect(res.body).toEqual({
      error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred' },
    });
    expect(res.text).not.toMatch(/boom|stack|\.js:\d+/);
    expect(console.error).toHaveBeenCalled();
  });
});
