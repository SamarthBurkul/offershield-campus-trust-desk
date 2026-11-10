'use strict';

/**
 * Centralised, validated configuration.
 * This is the ONLY module in the server allowed to read process.env.
 */
const path = require('node:path');
const dotenv = require('dotenv');
const { z } = require('zod');

dotenv.config({ path: path.resolve(__dirname, '../../.env'), quiet: true });

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

const envSchema = z.object({
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
  // Placeholders for later phases (not used in Phase 1).
  MONGODB_URI: z.string().min(1).optional(),
  JWT_SECRET: z.string().min(32, { error: 'must be at least 32 characters' }).optional(),
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
  return Object.freeze({
    nodeEnv: env.NODE_ENV,
    isProduction: env.NODE_ENV === 'production',
    port: env.PORT,
    clientOrigins: Object.freeze([...env.CLIENT_ORIGINS]),
    rateLimit: Object.freeze({
      windowMs: env.API_RATE_LIMIT_WINDOW_MS,
      max: env.API_RATE_LIMIT_MAX,
    }),
    mongodbUri: env.MONGODB_URI,
    jwtSecret: env.JWT_SECRET,
  });
}

// Fail fast at startup if the real environment is invalid.
const config = loadConfig(process.env);

module.exports = { config, loadConfig, ConfigError };
