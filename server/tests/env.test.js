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

describe('loadConfig', () => {
  it('parses valid input into typed values', () => {
    const config = loadConfig({
      NODE_ENV: 'production',
      PORT: '8080',
      CLIENT_ORIGINS: 'http://localhost:5173, https://desk.example.edu',
      API_RATE_LIMIT_WINDOW_MS: '60000',
      API_RATE_LIMIT_MAX: '50',
    });

    expect(config.nodeEnv).toBe('production');
    expect(config.isProduction).toBe(true);
    expect(config.port).toBe(8080);
    expect(typeof config.port).toBe('number');
    expect(config.clientOrigins).toEqual(['http://localhost:5173', 'https://desk.example.edu']);
    expect(Array.isArray(config.clientOrigins)).toBe(true);
    expect(config.rateLimit).toEqual({ windowMs: 60000, max: 50 });
  });

  it('applies defaults for an empty environment', () => {
    const config = loadConfig({});

    expect(config.nodeEnv).toBe('development');
    expect(config.port).toBe(5000);
    expect(config.clientOrigins).toEqual(['http://localhost:5173']);
    expect(config.rateLimit.windowMs).toBeGreaterThan(0);
    expect(config.rateLimit.max).toBeGreaterThan(0);
    expect(config.mongodbUri).toBeUndefined();
    expect(config.jwtSecret).toBeUndefined();
  });

  it('returns a frozen config', () => {
    const config = loadConfig({});

    expect(Object.isFrozen(config)).toBe(true);
    expect(Object.isFrozen(config.clientOrigins)).toBe(true);
  });

  it('throws an error naming PORT when PORT is invalid', () => {
    const err = captureError(() => loadConfig({ PORT: 'not-a-port' }));

    expect(err).toBeInstanceOf(ConfigError);
    expect(err.invalidKeys).toEqual(['PORT']);
    expect(err.message).toMatch(/PORT/);
  });

  it('throws an error naming CLIENT_ORIGINS when an origin is invalid', () => {
    const err = captureError(() => loadConfig({ CLIENT_ORIGINS: 'http://localhost:5173,not a url' }));

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
