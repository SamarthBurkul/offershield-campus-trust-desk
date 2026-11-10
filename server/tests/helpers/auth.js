'use strict';

const request = require('supertest');
const { createApp } = require('../../src/app');
const { loadConfig } = require('../../src/config/env');

// Test-only secret; never used outside the test suite.
const TEST_JWT_SECRET = 'test-only-jwt-secret-0123456789-abcdefghijklmnop';

function createTestConfig(overrides = {}) {
  return loadConfig({
    NODE_ENV: 'test',
    JWT_SECRET: TEST_JWT_SECRET,
    API_RATE_LIMIT_MAX: '100000',
    AUTH_RATE_LIMIT_MAX: '100000',
    ...overrides,
  });
}

function createTestApp(overrides) {
  return createApp(createTestConfig(overrides));
}

/** The raw Set-Cookie header for the session cookie, or undefined. */
function sessionSetCookie(res) {
  return (res.headers['set-cookie'] || []).find((cookie) => cookie.startsWith('os_session='));
}

/** "os_session=<token>" suitable for a Cookie request header. */
function sessionCookie(res) {
  const header = sessionSetCookie(res);
  return header ? header.split(';')[0] : undefined;
}

/** Log in and return a supertest agent that carries the session cookie. */
async function loginAgent(app, email, password) {
  const agent = request.agent(app);
  const res = await agent.post('/api/v1/auth/login').send({ email, password });
  if (res.status !== 200) throw new Error(`login failed for test user: ${res.status}`);
  return agent;
}

module.exports = { TEST_JWT_SECRET, createTestConfig, createTestApp, sessionSetCookie, sessionCookie, loginAgent };
