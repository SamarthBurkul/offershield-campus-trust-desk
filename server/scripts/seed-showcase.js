'use strict';

/**
 * Create the "Demo Institute of Technology" showcase college (code demo-campus, isDemo=true) with six
 * weeks of realistic, anonymised activity. All demo accounts use SEED_DEMO_PASSWORD.
 *
 *   npm run seed:showcase -w server              create it if missing (idempotent)
 *   npm run seed:showcase -w server -- --reset   delete ALL isDemo colleges (and their data), then
 *                                                re-create the showcase and the demo-alpha/beta colleges
 *
 * Refuses to run in production unless ALLOW_DEMO_SEED=true. Prints emails, roles and the demo join
 * code, never passwords.
 */
const { config } = require('../src/config/env');
const { connectDB, disconnectDB } = require('../src/config/db');
const { seedShowcase, SHOWCASE } = require('./lib/showcase');
const { resetDemoColleges } = require('./lib/demoReset');
const { seedDemoColleges } = require('./lib/demoColleges');
const { assertDemoSeedAllowed, requireDemoPassword, safeErrorDetail } = require('./lib/seedGuard');

async function main() {
  assertDemoSeedAllowed(config);
  const demoPassword = requireDemoPassword(config);
  const reset = process.argv.includes('--reset');

  await connectDB(config.mongodbUri);

  if (reset) {
    const { colleges, deleted } = await resetDemoColleges();
    console.log(`[seed:showcase] reset removed ${colleges.length} demo college(s): ${colleges.join(', ') || 'none'}`);
    console.table(deleted);
  }

  const started = Date.now();
  const result = await seedShowcase({ demoPassword, config, log: (line) => console.log(line) });
  if (result.created) console.log(`[seed:showcase] built in ${Math.round((Date.now() - started) / 1000)} s`);
  if (reset) await seedDemoColleges(demoPassword, { log: (line) => console.log(line) });

  console.log('\n[seed:showcase] Accounts (password: the SEED_DEMO_PASSWORD value from server/.env)');
  console.table(result.accounts);
  console.log(`[seed:showcase] College code: ${SHOWCASE.COLLEGE.code}   Student join code (demo only): ${SHOWCASE.COLLEGE.joinCode}`);
}

main()
  .catch((err) => {
    console.error(`[seed:showcase] Failed: ${safeErrorDetail(err)}`);
    process.exitCode = 1;
  })
  .finally(() => disconnectDB());
