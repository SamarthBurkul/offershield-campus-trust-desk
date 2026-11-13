'use strict';

const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { useTestDatabase } = require('./helpers/db');
const { createTestConfig } = require('./helpers/auth');
const { createCollegeWithMembers } = require('./helpers/factories');
const { loadConfig, ConfigError } = require('../src/config/env');
const email = require('../src/services/email');
const { createBrevoProvider } = require('../src/services/email/brevoProvider');
const { runEmailTest, formatResult } = require('../scripts/lib/emailTest');

useTestDatabase();

const KEY = 'xkeysib-test-only-not-a-real-key-0123456789';
const BREVO_ENV = { EMAIL_PROVIDER: 'brevo', BREVO_API_KEY: KEY, EMAIL_FROM: 'desk@offershield.test' };
const jsonResponse = (status, body = {}) => new Response(JSON.stringify(body), { status });

afterEach(() => {
  jest.restoreAllMocks();
  email.configureEmail(createTestConfig());
});

describe('email failure log line (Phase 9.1)', () => {
  test('a failed send prints one JSON line with type, priority, status, errorCode and providerStatus only', async () => {
    const lines = [];
    const fetchImpl = jest.fn().mockResolvedValue(jsonResponse(401, { code: 'unauthorized', message: `Key not found ${KEY}` }));
    email.configureEmail(createTestConfig(BREVO_ENV), { fetchImpl, eventSink: (line) => lines.push(line) });
    const { student } = await createCollegeWithMembers('alpha');

    expect(await email.sendEmail(student, 'verify_email', { code: '482913' })).toBe('failed');
    expect(lines).toHaveLength(1);
    const event = JSON.parse(lines[0]);
    expect(Object.keys(event).sort()).toEqual(['errorCode', 'event', 'priority', 'providerStatus', 'status', 't', 'type']);
    expect(event).toMatchObject({ event: 'email_send', type: 'verify_email', priority: 'critical', status: 'failed', errorCode: 'BREVO_UNAUTHORIZED', providerStatus: 401 });
    for (const secret of [KEY, '482913', 'Key not found', 'student@alpha.test.edu', 'verification code']) expect(lines[0]).not.toContain(secret);
  });

  test('skipped_budget is printed too; "sent" prints only in development', async () => {
    const lines = [];
    email.configureEmail(createTestConfig({ EMAIL_DAILY_BUDGET: '0' }), { eventSink: (line) => lines.push(line) });
    const { student } = await createCollegeWithMembers('alpha');
    expect(await email.sendEmail(student, 'case_decision', { caseNumber: 'OS-1' })).toBe('skipped_budget');
    expect(JSON.parse(lines[0])).toMatchObject({ event: 'email_send', type: 'case_decision', priority: 'normal', status: 'skipped_budget', errorCode: null });

    lines.length = 0;
    email.configureEmail(createTestConfig(), { eventSink: (line) => lines.push(line) });
    expect(await email.sendEmail(student, 'password_changed', {})).toBe('sent');
    expect(lines).toEqual([]);

    const dev = loadConfig({ NODE_ENV: 'development', MONGODB_URI: 'mongodb://127.0.0.1/x', JWT_SECRET: 'test-only-secret-value-0123456789abcdef' });
    email.configureEmail(dev, { sink: () => {}, eventSink: (line) => lines.push(line) });
    expect(await email.sendEmail(student, 'password_changed', {})).toBe('sent');
    expect(lines.map((line) => JSON.parse(line))).toEqual([expect.objectContaining({ event: 'email_send', type: 'password_changed', status: 'sent' })]);
    expect(Object.keys(JSON.parse(lines[0])).sort()).toEqual(['event', 'status', 't', 'type']);
  });

  test.each([
    [401, { code: 'unauthorized' }, 'BREVO_UNAUTHORIZED'],
    [403, { code: 'permission_denied', message: 'Unrecognised IP address 1.2.3.4' }, 'BREVO_PERMISSION_DENIED'],
    [400, { code: 'invalid_parameter', message: 'sender is not valid' }, 'BREVO_INVALID_PARAMETER'],
    [400, { code: 'something_new', message: 'x' }, 'BREVO_400'],
    [404, null, 'BREVO_404'],
  ])('Brevo %s %j maps to %s (message text is never used)', async (status, body, expected) => {
    const fetchImpl = jest.fn().mockResolvedValue(body ? jsonResponse(status, body) : new Response('not json', { status }));
    const provider = createBrevoProvider({ apiKey: KEY, from: 'a@b.test', fromName: 'X', fetchImpl });
    const err = await provider.send({ to: 'x@y.test', subject: 's', text: 't', html: 'h' }).catch((e) => e);
    expect(err).toMatchObject({ code: expected, providerStatus: status });
    expect(err.message).not.toMatch(/IP address|sender is not valid/);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });
});

describe('BREVO_API_KEY format check (Phase 9.1)', () => {
  test.each(['development', 'production'])('an SMTP key (xsmtpsib-) is refused at startup in %s without printing it', (nodeEnv) => {
    const smtpKey = 'xsmtpsib-test-only-0123456789abcdef';
    let error;
    try {
      loadConfig({ NODE_ENV: nodeEnv, CLIENT_ORIGINS: 'https://desk.example.edu', MONGODB_URI: 'mongodb://127.0.0.1/x', JWT_SECRET: 'test-only-secret-value-0123456789abcdef', ...BREVO_ENV, BREVO_API_KEY: smtpKey });
    } catch (err) {
      error = err;
    }
    expect(error).toBeInstanceOf(ConfigError);
    expect(error.invalidKeys).toEqual(['BREVO_API_KEY']);
    expect(error.message).toContain('BREVO_API_KEY: is an SMTP key; create an API key (xkeysib-…)');
    expect(error.message).not.toContain(smtpKey);
  });
});

describe('ops:email-test (Phase 9.1)', () => {
  const brevoConfig = () => loadConfig({ NODE_ENV: 'development', MONGODB_URI: 'mongodb://127.0.0.1/x', JWT_SECRET: 'test-only-secret-value-0123456789abcdef', ...BREVO_ENV });

  test('success prints only ok and the message id', async () => {
    const fetchImpl = jest.fn().mockResolvedValue(jsonResponse(201, { messageId: '<test-1@smtp-relay.brevo>' }));
    const result = await runEmailTest({ config: brevoConfig(), to: 'Me@Example.com', fetchImpl });
    expect(result).toEqual({ ok: true, messageId: '<test-1@smtp-relay.brevo>' });
    expect(formatResult(result)).toBe('ok messageId=<test-1@smtp-relay.brevo>');
    const payload = JSON.parse(fetchImpl.mock.calls[0][1].body);
    expect(payload.to).toEqual([{ email: 'me@example.com' }]);
    expect(payload.subject).toBe('OfferShield test email');
  });

  test('failure prints only errorCode and providerStatus', async () => {
    const fetchImpl = jest.fn().mockResolvedValue(jsonResponse(403, { code: 'permission_denied', message: `blocked ${KEY}` }));
    const result = await runEmailTest({ config: brevoConfig(), to: 'me@example.com', fetchImpl });
    expect(result).toEqual({ ok: false, errorCode: 'BREVO_PERMISSION_DENIED', providerStatus: 403 });
    const line = formatResult(result);
    expect(line).toBe('errorCode=BREVO_PERMISSION_DENIED providerStatus=403');
    expect(line).not.toContain(KEY);
    expect(line).not.toContain('me@example.com');
  });

  test('refuses with the log provider or a bad address, without calling fetch', async () => {
    const fetchImpl = jest.fn();
    expect(await runEmailTest({ config: createTestConfig(), to: 'me@example.com', fetchImpl })).toEqual({ ok: false, errorCode: 'PROVIDER_IS_LOG', providerStatus: null });
    expect(await runEmailTest({ config: brevoConfig(), to: 'not-an-address', fetchImpl })).toEqual({ ok: false, errorCode: 'INVALID_TO_ADDRESS', providerStatus: null });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  test('the script itself refuses with EMAIL_PROVIDER=log and prints one line', () => {
    const script = path.join(__dirname, '../scripts/ops-email-test.js');
    const run = spawnSync(process.execPath, [script, '--to', 'me@example.com'], {
      // A clean environment pinned to the log provider (so no real email can be sent); config falls back to
      // server/.env only for keys not set here. PATH and SystemRoot are needed to start Node on Windows.
      // eslint-disable-next-line no-restricted-properties
      env: { PATH: process.env.PATH, SystemRoot: process.env.SystemRoot, NODE_ENV: 'test', JWT_SECRET: 'test-only-secret-value-0123456789abcdef', EMAIL_PROVIDER: 'log' },
      encoding: 'utf8',
    });
    expect(run.status).toBe(1);
    expect(run.stdout.trim()).toBe('[ops:email-test] errorCode=PROVIDER_IS_LOG providerStatus=-');
    expect(run.stdout).not.toContain('me@example.com');
  });
});
