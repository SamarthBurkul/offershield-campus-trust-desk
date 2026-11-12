'use strict';

/**
 * Idempotently create two demo colleges (isDemo=true) with staff and students, all using SEED_DEMO_PASSWORD.
 * Usage: npm run seed:demo -w server
 * Refuses to run in production unless ALLOW_DEMO_SEED=true. Prints emails, roles and the demo join codes, never passwords.
 */
const { config } = require('../src/config/env');
const { connectDB, disconnectDB } = require('../src/config/db');
const { DEMO_COLLEGES, seedDemoColleges } = require('./lib/demoColleges');
const { assertDemoSeedAllowed, requireDemoPassword, safeErrorDetail } = require('./lib/seedGuard');

async function main() {
  assertDemoSeedAllowed(config);
  const demoPassword = requireDemoPassword(config);

  await connectDB(config.mongodbUri);
  const summary = await seedDemoColleges(demoPassword);

  console.log('\n[seed:demo] Accounts (password: the SEED_DEMO_PASSWORD value from server/.env)');
  console.table(summary);
  console.log('[seed:demo] Student join codes (demo only):');
  for (const spec of DEMO_COLLEGES) console.log(`  ${spec.code}: ${spec.joinCode}`);
}

main()
  .catch((err) => {
    console.error(`[seed:demo] Failed: ${safeErrorDetail(err)}`);
    process.exitCode = 1;
  })
  .finally(() => disconnectDB());
