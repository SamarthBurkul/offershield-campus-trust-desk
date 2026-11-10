'use strict';

/**
 * Centralised, validated configuration.
 * This is the ONLY module in the server allowed to read process.env.
 */
const path = require('node:path');
const dotenv = require('dotenv');
const { z } = require('zod');

// Tests never read server/.env, so they cannot pick up real credentials or reach a real database.
if (process.env.NODE_ENV !== 'test') {
  dotenv.config({ path: path.resolve(__dirname, '../../.env'), quiet: true });
}

const positiveInt = (defaultValue) => z.coerce.number().int().positive().default(defaultValue);

const isBareOrigin = (value) => {
  try {
    return new URL(value).origin === value;
  } catch {
    // Unparseable values are already reported by the URL check.
    return true;
  }
};

const originSchema = z
  .url({ protocol: /^https?$/, error: 'must be a valid http(s) URL' })
  .refine(isBareOrigin, { error: 'must be an origin (scheme://host[:port]) with no path or trailing slash' });

const DURATION_UNITS = { s: 1, m: 60, h: 3600, d: 86400 };

// A small, explicit duration format ("90s", "30m", "8h", "7d") so the JWT expiry and the
// cookie max-age are always derived from the same number of seconds.
const durationSeconds = z
  .string()
  .regex(/^\d+[smhd]$/, { error: 'must be a whole number followed by s, m, h or d (e.g. 8h)' })
  .transform((value) => Number(value.slice(0, -1)) * DURATION_UNITS[value.slice(-1)])
  .refine((seconds) => seconds > 0, { error: 'must be greater than zero' });

const optionalString = z.string().min(1).optional();

const envSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: z.coerce.number().int().min(1).max(65535).default(5000),
    CLIENT_ORIGINS: z
      .string()
      .default('http://localhost:5173')
      .transform((value) =>
        value
          .split(',')
          .map((origin) => origin.trim())
          .filter(Boolean),
      )
      .pipe(z.array(originSchema).min(1, { error: 'must list at least one origin' })),
    API_RATE_LIMIT_WINDOW_MS: positiveInt(15 * 60 * 1000),
    API_RATE_LIMIT_MAX: positiveInt(300),
    MONGODB_URI: optionalString,
    JWT_SECRET: z.string().min(32, { error: 'must be at least 32 characters' }).optional(),
    JWT_EXPIRES_IN: z.string().default('8h').pipe(durationSeconds),
    AUTH_RATE_LIMIT_WINDOW_MS: positiveInt(15 * 60 * 1000),
    AUTH_RATE_LIMIT_MAX: positiveInt(10),
    // Used only by the seed scripts.
    SEED_SUPERADMIN_EMAIL: optionalString,
    SEED_SUPERADMIN_PASSWORD: optionalString,
    SEED_DEMO_PASSWORD: optionalString,
  })
  .superRefine((env, ctx) => {
    // Tests supply their own database and secret; real environments must configure both.
    if (env.NODE_ENV === 'test') return;
    for (const key of ['MONGODB_URI', 'JWT_SECRET']) {
      if (env[key] === undefined) {
        ctx.addIssue({ code: 'custom', path: [key], message: `is required when NODE_ENV is ${env.NODE_ENV}` });
      }
    }
  });

class ConfigError extends Error {
  constructor(invalidKeys, details) {
    super(`Invalid environment configuration: ${details.join('; ')}`);
    this.name = 'ConfigError';
    this.invalidKeys = invalidKeys;
  }
}

/**
 * Parse and validate an environment-like object.
 * Error messages name the offending keys and the rule broken, never the values.
 * @param {Record<string, string | undefined>} envObject
 */
function loadConfig(envObject = {}) {
  const result = envSchema.safeParse(envObject);

  if (!result.success) {
    const details = [];
    const invalidKeys = [];
    for (const issue of result.error.issues) {
      const key = String(issue.path[0] ?? 'unknown');
      if (!invalidKeys.includes(key)) invalidKeys.push(key);
      const position = issue.path.length > 1 ? ` (entry ${issue.path[1]})` : '';
      details.push(`${key}${position}: ${issue.message}`);
    }
    throw new ConfigError(invalidKeys, details);
  }

  const env = result.data;
  const isProduction = env.NODE_ENV === 'production';
  return Object.freeze({
    nodeEnv: env.NODE_ENV,
    isProduction,
    port: env.PORT,
    clientOrigins: Object.freeze([...env.CLIENT_ORIGINS]),
    rateLimit: Object.freeze({
      windowMs: env.API_RATE_LIMIT_WINDOW_MS,
      max: env.API_RATE_LIMIT_MAX,
    }),
    authRateLimit: Object.freeze({
      windowMs: env.AUTH_RATE_LIMIT_WINDOW_MS,
      max: env.AUTH_RATE_LIMIT_MAX,
    }),
    mongodbUri: env.MONGODB_URI,
    jwtSecret: env.JWT_SECRET,
    jwtExpiresInSeconds: env.JWT_EXPIRES_IN,
    cookieSecure: isProduction,
    seed: Object.freeze({
      superadminEmail: env.SEED_SUPERADMIN_EMAIL,
      superadminPassword: env.SEED_SUPERADMIN_PASSWORD,
      demoPassword: env.SEED_DEMO_PASSWORD,
    }),
  });
}

// Fail fast at startup if the real environment is invalid.
const config = loadConfig(process.env);

module.exports = { config, loadConfig, ConfigError };
