'use strict';

const request = require('supertest');
const { useTestDatabase } = require('./helpers/db');
const { createTestApp, createTestConfig } = require('./helpers/auth');
const { createCollegeWithMembers } = require('./helpers/factories');
const { loadConfig, ConfigError } = require('../src/config/env');
const { EmailLog } = require('../src/models/EmailLog');
const email = require('../src/services/email');
const { createBrevoProvider, BREVO_URL } = require('../src/services/email/brevoProvider');
const { createLogProvider } = require('../src/services/email/logProvider');
const { renderEmail } = require('../src/services/email/templates');
const budget = require('../src/services/email/budget');

useTestDatabase();

beforeEach(() => {
  jest.spyOn(console, 'error').mockImplementation(() => {});
  jest.spyOn(console, 'warn').mockImplementation(() => {});
});
afterEach(() => {
  jest.restoreAllMocks();
  email.configureEmail(createTestConfig());
});

const BREVO_ENV = { EMAIL_PROVIDER: 'brevo', BREVO_API_KEY: 'test-brevo-key-not-real', EMAIL_FROM: 'desk@offershield.test' };
const message = { to: 'student@alpha.test.edu', toName: 'Asha', subject: 'Hello', text: 'Body', html: '<p>Body</p>' };
const jsonResponse = (status, body = {}) => new Response(JSON.stringify(body), { status });

describe('Brevo provider (G1)', () => {
  test('POSTs to the fixed Brevo URL with the api-key header and a transactional payload', async () => {
    const fetchImpl = jest.fn().mockResolvedValue(jsonResponse(201, { messageId: '<abc@brevo>' }));
    const provider = createBrevoProvider({ apiKey: 'k-1', from: 'desk@offershield.test', fromName: 'OfferShield', fetchImpl });
    expect(await provider.send(message)).toEqual({ messageId: '<abc@brevo>' });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toBe('https://api.brevo.com/v3/smtp/email');
    expect(url).toBe(BREVO_URL);
    expect(init.method).toBe('POST');
    expect(init.headers['api-key']).toBe('k-1');
    expect(init.signal).toBeInstanceOf(AbortSignal);
    expect(JSON.parse(init.body)).toEqual({
      sender: { email: 'desk@offershield.test', name: 'OfferShield' },
      to: [{ email: 'student@alpha.test.edu', name: 'Asha' }],
      subject: 'Hello',
      textContent: 'Body',
      htmlContent: '<p>Body</p>',
    });
  });

  test('retries once on 5xx and on network errors, never on 4xx', async () => {
    const make = (...responses) => {
      const fetchImpl = jest.fn();
      for (const r of responses) {
        if (r instanceof Error) fetchImpl.mockRejectedValueOnce(r);
        else fetchImpl.mockResolvedValueOnce(r);
      }
      return { fetchImpl, provider: createBrevoProvider({ apiKey: 'k', from: 'a@b.test', fromName: 'X', fetchImpl }) };
    };
    let t = make(jsonResponse(503), jsonResponse(201, { messageId: 'm2' }));
    expect(await t.provider.send(message)).toEqual({ messageId: 'm2' });
    expect(t.fetchImpl).toHaveBeenCalledTimes(2);

    t = make(new TypeError('fetch failed'), jsonResponse(201, { messageId: 'm3' }));
    expect(await t.provider.send(message)).toEqual({ messageId: 'm3' });
    expect(t.fetchImpl).toHaveBeenCalledTimes(2);

    t = make(jsonResponse(500), jsonResponse(502));
    await expect(t.provider.send(message)).rejects.toMatchObject({ code: 'BREVO_5XX' });
    expect(t.fetchImpl).toHaveBeenCalledTimes(2);

    t = make(jsonResponse(401));
    await expect(t.provider.send(message)).rejects.toMatchObject({ code: 'BREVO_401' });
    expect(t.fetchImpl).toHaveBeenCalledTimes(1);
  });

  test('aborts after the timeout (and retries once)', async () => {
    jest.useFakeTimers();
    try {
      const fetchImpl = jest.fn((_url, init) => new Promise((_resolve, reject) => {
        init.signal.addEventListener('abort', () => reject(Object.assign(new Error('aborted'), { name: 'AbortError' })));
      }));
      const provider = createBrevoProvider({ apiKey: 'k', from: 'a@b.test', fromName: 'X', fetchImpl });
      const sent = provider.send(message);
      const assertion = expect(sent).rejects.toMatchObject({ code: 'BREVO_TIMEOUT' });
      await jest.advanceTimersByTimeAsync(10_000);
      await jest.advanceTimersByTimeAsync(10_000);
      await assertion;
      expect(fetchImpl).toHaveBeenCalledTimes(2);
    } finally {
      jest.useRealTimers();
    }
  });

  test('errors never carry the API key or the payload', async () => {
    const fetchImpl = jest.fn().mockResolvedValue(jsonResponse(400, { message: 'bad sender test-brevo-key-not-real' }));
    const provider = createBrevoProvider({ apiKey: 'test-brevo-key-not-real', from: 'a@b.test', fromName: 'X', fetchImpl });
    const err = await provider.send(message).catch((e) => e);
    expect(err.message).not.toContain('test-brevo-key-not-real');
    expect(err.message).not.toContain('student@alpha.test.edu');
  });
});

describe('log provider (G1)', () => {
  test('prints one line with the code in development, nothing in test or production', async () => {
    const lines = [];
    const dev = createLogProvider({ nodeEnv: 'development', sink: (line) => lines.push(line) });
    await dev.send({ ...message, subject: 'Your OfferShield verification code', devCode: '123456' });
    await dev.send({ ...message, subject: 'Reset', devLink: 'http://localhost:5173/reset-password#token=abc' });
    expect(lines).toHaveLength(2);
    expect(lines[0]).toBe('[email:log] to=student@alpha.test.edu subject="Your OfferShield verification code" code=123456');
    expect(lines[1]).toContain('link=http://localhost:5173/reset-password#token=abc');

    for (const nodeEnv of ['test', 'production']) {
      const quiet = [];
      const provider = createLogProvider({ nodeEnv, sink: (line) => quiet.push(line) });
      await provider.send({ ...message, devCode: '654321' });
      expect(quiet).toEqual([]);
      expect(provider.outbox).toHaveLength(1);
    }
  });

  test('in production the log provider counts as "email off": nothing is sent or logged', async () => {
    email.configureEmail(loadConfig({ NODE_ENV: 'production', CLIENT_ORIGINS: 'https://desk.example.edu', MONGODB_URI: 'mongodb://127.0.0.1/x', JWT_SECRET: 'test-only-secret-value-0123456789abcdef' }));
    expect(email.isEmailEnabled()).toBe(false);
    const { student } = await createCollegeWithMembers('alpha');
    expect(await email.sendEmail(student, 'password_changed', {})).toBe('disabled');
    expect(await EmailLog.countDocuments()).toBe(0);
  });
});

describe('daily budget (G1)', () => {
  test('critical mail is allowed under 290 sent today; normal mail under EMAIL_DAILY_BUDGET', async () => {
    const { student } = await createCollegeWithMembers('alpha');
    email.configureEmail(createTestConfig({ EMAIL_DAILY_BUDGET: '3' }));
    const sentRows = (n, createdAt = new Date()) =>
      EmailLog.collection.insertMany(Array.from({ length: n }, () => ({ userId: student._id, type: 'case_decision', priority: 'normal', status: 'sent', createdAt })));

    await sentRows(2);
    expect(await email.sendEmail(student, 'case_decision', { caseNumber: 'OS-1' })).toBe('sent');
    expect(await email.sendEmail(student, 'case_decision', { caseNumber: 'OS-1' })).toBe('skipped_budget');
    expect(await email.sendEmail(student, 'password_changed', {})).toBe('sent');

    // Yesterday's mail does not count; skipped and failed rows never count.
    await EmailLog.deleteMany({});
    await sentRows(400, new Date(Date.now() - 26 * 60 * 60 * 1000));
    await EmailLog.collection.insertMany(Array.from({ length: 300 }, () => ({ userId: student._id, type: 'case_decision', priority: 'normal', status: 'skipped_budget', createdAt: new Date() })));
    expect(await budget.sentToday()).toBe(0);

    await EmailLog.deleteMany({});
    await sentRows(289);
    expect(await budget.canSend('critical', 3)).toBe(true);
    await sentRows(1);
    expect(await budget.canSend('critical', 3)).toBe(false);
    expect(await email.sendEmail(student, 'verify_email', { code: '123456' })).toBe('skipped_budget');
  });

  test('budget counts from 00:00 UTC', () => {
    expect(budget.startOfUtcDay(new Date('2026-11-13T23:59:00+05:30')).toISOString()).toBe('2026-11-13T00:00:00.000Z');
    expect(budget.startOfUtcDay(new Date('2026-11-14T03:00:00+05:30')).toISOString()).toBe('2026-11-13T00:00:00.000Z');
  });
});

describe('preferences and logging (G1)', () => {
  test('opted-out recipients are logged as skipped_pref; critical mail ignores preferences', async () => {
    const { student } = await createCollegeWithMembers('alpha');
    const optedOut = { ...student.toObject(), emailPrefs: { caseUpdates: false, advisories: true, staffAlerts: true } };
    expect(await email.sendEmail(optedOut, 'case_decision', { caseNumber: 'OS-2' })).toBe('skipped_pref');
    expect(await email.sendEmail(optedOut, 'password_changed', {})).toBe('sent');
    const logs = await EmailLog.find({}).sort({ createdAt: 1 }).lean();
    expect(logs.map((log) => [log.type, log.priority, log.status])).toEqual([
      ['case_decision', 'normal', 'skipped_pref'],
      ['password_changed', 'critical', 'sent'],
    ]);
    expect(Object.keys(logs[1]).sort()).toEqual(['__v', '_id', 'collegeId', 'createdAt', 'errorCode', 'priority', 'providerMessageId', 'status', 'type', 'userId']);
  });

  test('a provider failure is logged as failed with a code only and never throws', async () => {
    email.configureEmail(createTestConfig(BREVO_ENV), { fetchImpl: jest.fn().mockResolvedValue(jsonResponse(500)) });
    const { student } = await createCollegeWithMembers('alpha');
    expect(await email.sendEmail(student, 'password_changed', {})).toBe('failed');
    const log = await EmailLog.findOne({}).lean();
    expect(log).toMatchObject({ status: 'failed', errorCode: 'BREVO_5XX' });
    expect(console.error.mock.calls.flat().join(' ')).not.toContain('test-brevo-key-not-real');
  });

  test('a slow or failing provider never fails or slows the API (forgot-password returns at once)', async () => {
    // A provider that takes 3 s to answer.
    const slow = jest.fn(() => new Promise((resolve) => setTimeout(() => resolve(jsonResponse(201, { messageId: 'slow' })), 3000)));
    const app = createTestApp(BREVO_ENV, { emailFetch: slow });
    await createCollegeWithMembers('alpha');
    const started = Date.now();
    const res = await request(app).post('/api/v1/auth/forgot-password').send({ email: 'student@alpha.test.edu' });
    expect(res.status).toBe(202);
    expect(Date.now() - started).toBeLessThan(2000);
    await email.flushEmails();
    expect(slow).toHaveBeenCalledTimes(1);
    expect(await EmailLog.countDocuments({ type: 'password_reset', status: 'sent' })).toBe(1);
  });
});

describe('templates (G1)', () => {
  const base = { baseUrl: 'https://desk.example.edu' };

  test('escape HTML, read only allow-listed fields and carry the footer', () => {
    const rendered = renderEmail(
      'case_info_requested',
      {
        name: '<b>Asha</b>',
        caseNumber: 'OS-2026-0001',
        claimedCompany: '<script>alert(1)</script> Corp',
        studentMessage: 'SECRET decision text',
        decisionBasis: 'internal basis',
        note: 'internal note',
      },
      base,
    );
    expect(rendered.html).not.toContain('<script>');
    expect(rendered.html).toContain('&lt;script&gt;');
    expect(rendered.html).toContain('&lt;b&gt;Asha&lt;/b&gt;');
    for (const forbidden of ['SECRET decision text', 'internal basis', 'internal note']) {
      expect(rendered.text).not.toContain(forbidden);
      expect(rendered.html).not.toContain(forbidden);
    }
    expect(rendered.text).toContain('You received this email because you submitted a verification request.');
    expect(rendered.text).toContain('https://desk.example.edu/account');
    expect(rendered.html).toContain('href="https://desk.example.edu/account"');
    expect(rendered.priority).toBe('normal');
    expect(rendered.pref).toBe('caseUpdates');
  });

  test('every type renders a subject, text and HTML; critical types have no preference', () => {
    const critical = ['verify_email', 'password_reset', 'password_reset_google', 'password_changed'];
    for (const type of [...critical, 'case_info_requested', 'case_staff_message', 'case_decision', 'case_reopened', 'advisory_published', 'case_submitted', 'student_pending']) {
      const rendered = renderEmail(type, { caseNumber: 'OS-1', advisoryTitle: 'Fake recruiters', severity: 'critical', code: '123456', link: 'https://desk.example.edu/reset-password#token=t' }, base);
      expect(rendered.subject.length).toBeGreaterThan(5);
      expect(rendered.text).toContain('/account');
      expect(rendered.html.startsWith('<!doctype html>')).toBe(true);
      if (critical.includes(type)) {
        expect(rendered.priority).toBe('critical');
        expect(rendered.pref).toBeNull();
      }
    }
    expect(() => renderEmail('marketing', {}, base)).toThrow();
  });

  test('subjects strip line breaks (no header injection)', () => {
    const rendered = renderEmail('advisory_published', { advisoryTitle: 'Title\r\nBcc: victim@example.com', severity: 'warning' }, base);
    expect(rendered.subject).not.toMatch(/[\r\n]/);
  });
});

describe('startup configuration (G15)', () => {
  const PROD = { NODE_ENV: 'production', CLIENT_ORIGINS: 'https://desk.example.edu', MONGODB_URI: 'mongodb://127.0.0.1/x', JWT_SECRET: 'test-only-secret-value-0123456789abcdef' };
  const keysOf = (env) => {
    try {
      loadConfig(env);
      return null;
    } catch (err) {
      expect(err).toBeInstanceOf(ConfigError);
      return err.invalidKeys;
    }
  };

  test('production refuses REQUIRE_EMAIL_VERIFICATION=true with the log provider', () => {
    expect(keysOf({ ...PROD, REQUIRE_EMAIL_VERIFICATION: 'true' })).toEqual(['REQUIRE_EMAIL_VERIFICATION']);
    expect(keysOf({ ...PROD, ...BREVO_ENV, REQUIRE_EMAIL_VERIFICATION: 'true' })).toBeNull();
    // Development may use it with the log provider (codes print in the console).
    expect(keysOf({ NODE_ENV: 'development', MONGODB_URI: PROD.MONGODB_URI, JWT_SECRET: PROD.JWT_SECRET, REQUIRE_EMAIL_VERIFICATION: 'true' })).toBeNull();
  });

  test('brevo requires BREVO_API_KEY and EMAIL_FROM; partial Google config is refused', () => {
    expect(keysOf({ ...PROD, EMAIL_PROVIDER: 'brevo' }).sort()).toEqual(['BREVO_API_KEY', 'EMAIL_FROM']);
    expect(keysOf({ ...PROD, GOOGLE_CLIENT_ID: 'id-only' })).toEqual(['GOOGLE_CLIENT_SECRET']);
    expect(keysOf({ ...PROD, GOOGLE_CLIENT_SECRET: 'secret-only' })).toEqual(['GOOGLE_CLIENT_ID']);
    expect(keysOf({ ...PROD, EMAIL_PROVIDER: 'smtp' })).toEqual(['EMAIL_PROVIDER']);
  });

  test('defaults: log provider, budget 250, verification on only with brevo, Google off', () => {
    const config = loadConfig(PROD);
    expect(config.email).toMatchObject({ provider: 'log', dailyBudget: 250, fromName: 'OfferShield', requireVerification: false });
    expect(config.google.enabled).toBe(false);
    const brevo = loadConfig({ ...PROD, ...BREVO_ENV });
    expect(brevo.email.requireVerification).toBe(true);
    expect(loadConfig({ ...PROD, ...BREVO_ENV, REQUIRE_EMAIL_VERIFICATION: 'false' }).email.requireVerification).toBe(false);
    const google = loadConfig({ ...PROD, GOOGLE_CLIENT_ID: 'id', GOOGLE_CLIENT_SECRET: 'secret' });
    expect(google.google).toMatchObject({ enabled: true, redirectUri: 'https://desk.example.edu/api/v1/auth/google/callback' });
  });

  test('config errors name the keys but never print secret values', () => {
    const err = (() => {
      try {
        loadConfig({ ...PROD, EMAIL_PROVIDER: 'brevo', BREVO_API_KEY: 'very-secret-brevo-key', GOOGLE_CLIENT_SECRET: 'very-secret-google' });
      } catch (e) {
        return e;
      }
      return null;
    })();
    expect(err).toBeInstanceOf(ConfigError);
    expect(err.message).not.toContain('very-secret-brevo-key');
    expect(err.message).not.toContain('very-secret-google');
  });
});
