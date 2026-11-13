'use strict';

/**
 * Phase 9 rollout step (run once after deploying, before enabling Brevo / REQUIRE_EMAIL_VERIFICATION):
 *   npm run ops:backfill-email-verified -w server
 * Safe to re-run; prints counts only.
 */
const { config } = require('../src/config/env');
const { connectDB, disconnectDB } = require('../src/config/db');
const { backfillEmailVerified } = require('./lib/backfillEmailVerified');
const { safeErrorDetail } = require('./lib/seedGuard');

async function main() {
  await connectDB(config.mongodbUri);
  const result = await backfillEmailVerified();
  console.log(`[ops:backfill-email-verified] emailVerifiedAt set on ${result.emailVerifiedSet} account(s); authMethods set on ${result.authMethodsSet} account(s)`);
}

main()
  .catch((err) => {
    console.error(`[ops:backfill-email-verified] Failed: ${safeErrorDetail(err)}`);
    process.exitCode = 1;
  })
  .finally(() => disconnectDB());
