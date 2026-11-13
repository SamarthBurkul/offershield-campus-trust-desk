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

const booleanFlag = (defaultValue) =>
  z
    .enum(['true', 'false', '1', '0'])
    .default(defaultValue ? 'true' : 'false')
    .transform((value) => value === 'true' || value === '1');

// The placeholder shipped in server/.env.example; a production deployment must replace it.
const JWT_SECRET_PLACEHOLDER = 'replace-with-a-long-random-secret-of-32-plus-chars';

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
    // Unauthenticated /api traffic, per IP.
    API_RATE_LIMIT_MAX: positiveInt(300),
    // Authenticated /api traffic, per user (students on one campus Wi-Fi share a public IP).
    API_USER_RATE_LIMIT_MAX: positiveInt(600),
    // 0 = do not trust X-Forwarded-For; 1 = one proxy hop (Render). Defaults to 1 in production.
    TRUST_PROXY: z.coerce.number().int().min(0).max(10).optional(),
    MONGODB_URI: optionalString,
    JWT_SECRET: z.string().min(32, { error: 'must be at least 32 characters' }).optional(),
    JWT_EXPIRES_IN: z.string().default('8h').pipe(durationSeconds),
    AUTH_RATE_LIMIT_WINDOW_MS: positiveInt(15 * 60 * 1000),
    // Login: per IP + normalised email, and a looser per-IP ceiling (shared campus IPs).
    AUTH_RATE_LIMIT_MAX: positiveInt(10),
    AUTH_IP_RATE_LIMIT_MAX: positiveInt(200),
    REGISTER_RATE_LIMIT_WINDOW_MS: positiveInt(60 * 60 * 1000),
    REGISTER_RATE_LIMIT_MAX: positiveInt(60),
    CASE_CREATE_LIMIT_PER_HOUR: positiveInt(10),
    RECRUITER_VERIFICATION_DAYS: z.coerce.number().int().min(30).max(730).default(365),
    SIMHASH_MAX_DISTANCE: z.coerce.number().int().min(0).max(32).default(6),
    LOOKUP_LIMIT_PER_10MIN: positiveInt(60),
    CASE_STALE_DAYS: z.coerce.number().int().min(1).max(365).default(3),
    EVIDENCE_LINK_TTL_SECONDS: z.coerce.number().int().min(1).max(3600).default(300),
    APP_BASE_URL: originSchema.optional(),
    SUPPORT_EMAIL: z.email({ error: 'must be a valid email address' }).optional(),
    RETENTION_MONTHS: z.coerce.number().int().min(1).max(120).default(12),
    ALLOW_DEMO_SEED: booleanFlag(false),
    // Development-only escape hatch for a local production smoke on http://localhost; ignored for https.
    COOKIE_SECURE_OVERRIDE: z.enum(['true', 'false']).optional(),
    RENDER_GIT_COMMIT: optionalString,
    // Email (Phase 9). "log" keeps mail in memory (and prints OTPs/links in development only).
    EMAIL_PROVIDER: z.enum(['log', 'brevo']).default('log'),
    BREVO_API_KEY: optionalString,
    EMAIL_FROM: z.email({ error: 'must be a valid email address' }).optional(),
    EMAIL_FROM_NAME: z.string().min(1).max(80).default('OfferShield'),
    EMAIL_DAILY_BUDGET: z.coerce.number().int().min(0).max(100000).default(250),
    // Defaults to true only when a real provider is configured.
    REQUIRE_EMAIL_VERIFICATION: z.enum(['true', 'false', '1', '0']).optional(),
    // Google sign-in (OAuth 2.0 / OpenID Connect, server-side code flow with PKCE).
    GOOGLE_CLIENT_ID: optionalString,
    GOOGLE_CLIENT_SECRET: optionalString,
    GOOGLE_REDIRECT_URI: z.url({ protocol: /^https?$/, error: 'must be a valid http(s) URL' }).optional(),
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
    if (env.EMAIL_PROVIDER === 'brevo') {
      for (const key of ['BREVO_API_KEY', 'EMAIL_FROM']) {
        if (env[key] === undefined) ctx.addIssue({ code: 'custom', path: [key], message: 'is required when EMAIL_PROVIDER is brevo' });
      }
    }
    // Google is all-or-nothing: a partial setup is almost always a deployment mistake.
    const google = ['GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET'].filter((key) => env[key] !== undefined);
    if (google.length === 1) {
      const missing = google[0] === 'GOOGLE_CLIENT_ID' ? 'GOOGLE_CLIENT_SECRET' : 'GOOGLE_CLIENT_ID';
      ctx.addIssue({ code: 'custom', path: [missing], message: 'is required when Google sign-in is partly configured' });
    }
    if (env.NODE_ENV !== 'production') return;
    if (env.REQUIRE_EMAIL_VERIFICATION && ['true', '1'].includes(env.REQUIRE_EMAIL_VERIFICATION) && env.EMAIL_PROVIDER === 'log') {
      ctx.addIssue({ code: 'custom', path: ['REQUIRE_EMAIL_VERIFICATION'], message: 'cannot be true with EMAIL_PROVIDER=log in production (codes could not be delivered)' });
    }
    if (env.JWT_SECRET === JWT_SECRET_PLACEHOLDER) {
      ctx.addIssue({ code: 'custom', path: ['JWT_SECRET'], message: 'must be replaced (it is the .env.example placeholder)' });
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
  // CLIENT_ORIGINS has a development default, so "missing" is checked on the raw input.
  const missingOrigins = envObject.NODE_ENV === 'production' && !String(envObject.CLIENT_ORIGINS ?? '').trim();

  if (!result.success || missingOrigins) {
    const details = [];
    const invalidKeys = [];
    const issues = [...(result.success ? [] : result.error.issues)];
    if (missingOrigins) issues.push({ path: ['CLIENT_ORIGINS'], message: 'is required when NODE_ENV is production' });
    for (const issue of issues) {
      const key = String(issue.path[0] ?? 'unknown');
      if (!invalidKeys.includes(key)) invalidKeys.push(key);
      const position = issue.path.length > 1 ? ` (entry ${issue.path[1]})` : '';
      details.push(`${key}${position}: ${issue.message}`);
    }
    throw new ConfigError(invalidKeys, details);
  }

  const env = result.data;
  const isProduction = env.NODE_ENV === 'production';
  const httpsBase = Boolean(env.APP_BASE_URL && env.APP_BASE_URL.startsWith('https://'));
  // The override can only turn Secure off for a plain-http base URL (local production smoke).
  const cookieSecure = isProduction && !(env.COOKIE_SECURE_OVERRIDE === 'false' && !httpsBase);
  const requireEmailVerification =
    env.REQUIRE_EMAIL_VERIFICATION === undefined ? env.EMAIL_PROVIDER === 'brevo' : ['true', '1'].includes(env.REQUIRE_EMAIL_VERIFICATION);
  const googleEnabled = Boolean(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET);
  // Default: the public origin (APP_BASE_URL, else the first client origin, e.g. the Vite dev server that proxies /api).
  const publicOrigin = env.APP_BASE_URL ?? env.CLIENT_ORIGINS[0];
  return Object.freeze({
    nodeEnv: env.NODE_ENV,
    isProduction,
    port: env.PORT,
    clientOrigins: Object.freeze([...env.CLIENT_ORIGINS]),
    trustProxy: env.TRUST_PROXY ?? (isProduction ? 1 : 0),
    rateLimit: Object.freeze({
      windowMs: env.API_RATE_LIMIT_WINDOW_MS,
      max: env.API_RATE_LIMIT_MAX,
      userMax: env.API_USER_RATE_LIMIT_MAX,
    }),
    authRateLimit: Object.freeze({
      windowMs: env.AUTH_RATE_LIMIT_WINDOW_MS,
      max: env.AUTH_RATE_LIMIT_MAX,
      ipMax: env.AUTH_IP_RATE_LIMIT_MAX,
    }),
    registerRateLimit: Object.freeze({
      windowMs: env.REGISTER_RATE_LIMIT_WINDOW_MS,
      max: env.REGISTER_RATE_LIMIT_MAX,
    }),
    caseCreateLimitPerHour: env.CASE_CREATE_LIMIT_PER_HOUR,
    evidenceLinkTtlSeconds: env.EVIDENCE_LINK_TTL_SECONDS,
    caseStaleDays: env.CASE_STALE_DAYS,
    recruiterVerificationDays: env.RECRUITER_VERIFICATION_DAYS,
    simhashMaxDistance: env.SIMHASH_MAX_DISTANCE,
    lookupLimitPer10Min: env.LOOKUP_LIMIT_PER_10MIN,
    mongodbUri: env.MONGODB_URI,
    jwtSecret: env.JWT_SECRET,
    jwtExpiresInSeconds: env.JWT_EXPIRES_IN,
    cookieSecure,
    appBaseUrl: env.APP_BASE_URL ?? null,
    supportEmail: env.SUPPORT_EMAIL ?? null,
    retentionMonths: env.RETENTION_MONTHS,
    allowDemoSeed: env.ALLOW_DEMO_SEED,
    commit: env.RENDER_GIT_COMMIT ?? null,
    email: Object.freeze({
      provider: env.EMAIL_PROVIDER,
      brevoApiKey: env.BREVO_API_KEY,
      from: env.EMAIL_FROM ?? null,
      fromName: env.EMAIL_FROM_NAME,
      dailyBudget: env.EMAIL_DAILY_BUDGET,
      requireVerification: requireEmailVerification,
    }),
    google: Object.freeze({
      enabled: googleEnabled,
      clientId: env.GOOGLE_CLIENT_ID ?? null,
      clientSecret: env.GOOGLE_CLIENT_SECRET ?? null,
      redirectUri: env.GOOGLE_REDIRECT_URI ?? `${publicOrigin}/api/v1/auth/google/callback`,
    }),
    seed: Object.freeze({
      superadminEmail: env.SEED_SUPERADMIN_EMAIL,
      superadminPassword: env.SEED_SUPERADMIN_PASSWORD,
      demoPassword: env.SEED_DEMO_PASSWORD,
    }),
  });
}

/**
 * `node src/server.js --production` (npm start) runs in production without cross-env,
 * on Windows and Linux alike. The flag wins over a NODE_ENV=development left in a local .env.
 */
function resolveEnv(env, argv) {
  return argv.includes('--production') ? { ...env, NODE_ENV: 'production' } : env;
}

// Fail fast at startup if the real environment is invalid.
const config = loadConfig(resolveEnv(process.env, process.argv));

module.exports = { config, loadConfig, resolveEnv, ConfigError, JWT_SECRET_PLACEHOLDER };
