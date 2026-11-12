'use strict';

const { loadConfig, ConfigError } = require('../src/config/env');

function captureError(fn) {
  try {
    fn();
  } catch (err) {
    return err;
  }
  throw new Error('Expected function to throw');
}

// Development and production must configure a database and a JWT secret (Phase 2).
const REQUIRED = {
  MONGODB_URI: 'mongodb://127.0.0.1:27017/offershield-test',
  JWT_SECRET: 'test-only-secret-value-0123456789abcdef',
};

describe('loadConfig', () => {
  it('parses valid input into typed values', () => {
    const config = loadConfig({
      NODE_ENV: 'production',
      PORT: '8080',
      CLIENT_ORIGINS: 'http://localhost:5173, https://desk.example.edu',
      API_RATE_LIMIT_WINDOW_MS: '60000',
      API_RATE_LIMIT_MAX: '50',
      ...REQUIRED,
    });

    expect(config.nodeEnv).toBe('production');
    expect(config.isProduction).toBe(true);
    expect(config.port).toBe(8080);
    expect(typeof config.port).toBe('number');
    expect(config.clientOrigins).toEqual(['http://localhost:5173', 'https://desk.example.edu']);
    expect(Array.isArray(config.clientOrigins)).toBe(true);
    expect(config.rateLimit).toEqual({ windowMs: 60000, max: 50, userMax: 600 });
  });

  it('applies defaults when only the required keys are set', () => {
    const config = loadConfig({ ...REQUIRED });

    expect(config.nodeEnv).toBe('development');
    expect(config.port).toBe(5000);
    expect(config.clientOrigins).toEqual(['http://localhost:5173']);
    expect(config.rateLimit.windowMs).toBeGreaterThan(0);
    expect(config.rateLimit.max).toBeGreaterThan(0);
    expect(config.jwtExpiresInSeconds).toBe(8 * 3600);
    expect(config.authRateLimit).toEqual({ windowMs: 900000, max: 10, ipMax: 200 });
    expect(config.cookieSecure).toBe(false);
  });

  it('leaves the database and secret optional in test', () => {
    const config = loadConfig({ NODE_ENV: 'test' });

    expect(config.mongodbUri).toBeUndefined();
    expect(config.jwtSecret).toBeUndefined();
  });

  it.each(['development', 'production'])('requires MONGODB_URI and JWT_SECRET in %s', (nodeEnv) => {
    // Production additionally requires CLIENT_ORIGINS (Phase 7); covered in production.test.js.
    const err = captureError(() => loadConfig({ NODE_ENV: nodeEnv, CLIENT_ORIGINS: 'https://desk.example.edu' }));

    expect(err).toBeInstanceOf(ConfigError);
    expect(err.invalidKeys).toEqual(['MONGODB_URI', 'JWT_SECRET']);
  });

  it('derives cookieSecure from production and parses JWT_EXPIRES_IN', () => {
    expect(loadConfig({ NODE_ENV: 'production', CLIENT_ORIGINS: 'https://desk.example.edu', ...REQUIRED }).cookieSecure).toBe(true);
    expect(loadConfig({ ...REQUIRED, JWT_EXPIRES_IN: '30m' }).jwtExpiresInSeconds).toBe(1800);
    expect(captureError(() => loadConfig({ ...REQUIRED, JWT_EXPIRES_IN: 'soon' })).invalidKeys).toEqual(['JWT_EXPIRES_IN']);
  });

  it('never includes the database URI in error messages', () => {
    const uri = 'mongodb+srv://user:hunter2@cluster.example/db';
    const err = captureError(() => loadConfig({ MONGODB_URI: uri, JWT_SECRET: 'short' }));

    expect(err.message).not.toContain('hunter2');
    expect(err.message).not.toContain(uri);
  });

  it('returns a frozen config', () => {
    const config = loadConfig({ NODE_ENV: 'test' });

    expect(Object.isFrozen(config)).toBe(true);
    expect(Object.isFrozen(config.clientOrigins)).toBe(true);
  });

  it('throws an error naming PORT when PORT is invalid', () => {
    const err = captureError(() => loadConfig({ NODE_ENV: 'test', PORT: 'not-a-port' }));

    expect(err).toBeInstanceOf(ConfigError);
    expect(err.invalidKeys).toEqual(['PORT']);
    expect(err.message).toMatch(/PORT/);
  });

  it('throws an error naming CLIENT_ORIGINS when an origin is invalid', () => {
    const err = captureError(() => loadConfig({ NODE_ENV: 'test', CLIENT_ORIGINS: 'http://localhost:5173,not a url' }));

    expect(err).toBeInstanceOf(ConfigError);
    expect(err.invalidKeys).toEqual(['CLIENT_ORIGINS']);
    expect(err.message).toMatch(/CLIENT_ORIGINS/);
  });

  it('rejects origins with a path', () => {
    expect(() => loadConfig({ CLIENT_ORIGINS: 'https://desk.example.edu/app' })).toThrow(/CLIENT_ORIGINS/);
  });

  it('lists every invalid key at once', () => {
    const err = captureError(() => loadConfig({ NODE_ENV: 'staging', PORT: '70000' }));

    expect(err.invalidKeys).toEqual(expect.arrayContaining(['NODE_ENV', 'PORT']));
  });

  it('never includes secret values in the error message', () => {
    const secret = 'short-secret-value';
    const err = captureError(() => loadConfig({ JWT_SECRET: secret }));

    expect(err.message).toMatch(/JWT_SECRET/);
    expect(err.message).not.toContain(secret);
  });
});
