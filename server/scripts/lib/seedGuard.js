'use strict';

const { isPasswordAcceptable } = require('../../src/utils/password');

/** Demo seeds never run against production data unless ALLOW_DEMO_SEED=true is set explicitly. */
function assertDemoSeedAllowed(config) {
  if (config.isProduction && !config.allowDemoSeed) {
    throw new Error('Refusing to seed demo data when NODE_ENV=production (set ALLOW_DEMO_SEED=true to override)');
  }
}

function requireDemoPassword(config) {
  const { demoPassword } = config.seed;
  if (!demoPassword) throw new Error('SEED_DEMO_PASSWORD must be set in server/.env');
  if (!isPasswordAcceptable(demoPassword)) {
    throw new Error('SEED_DEMO_PASSWORD does not meet the password policy (10+ chars, a letter and a number)');
  }
  return demoPassword;
}

/** Script error output: this module's own messages in full, driver errors by name only (they can mention hosts). */
const safeErrorDetail = (err) => (err && err.name === 'Error' ? err.message : err && err.name);

module.exports = { assertDemoSeedAllowed, requireDemoPassword, safeErrorDetail };
