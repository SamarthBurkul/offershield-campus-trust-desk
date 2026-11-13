'use strict';

/**
 * Check the email provider end to end:
 *   npm run ops:email-test -w server -- --to you@example.com
 * Prints only "ok messageId=…" or "errorCode=… providerStatus=…". Refuses with EMAIL_PROVIDER=log.
 * Never prints the API key, the recipient or the message.
 */
const { runEmailTest, formatResult } = require('./lib/emailTest');

async function main() {
  const { config } = require('../src/config/env');
  const index = process.argv.indexOf('--to');
  const to = index > -1 ? process.argv[index + 1] : undefined;
  const result = await runEmailTest({ config, to });
  console.log(`[ops:email-test] ${formatResult(result)}`);
  if (!result.ok) process.exitCode = 1;
}

main().catch((err) => {
  // Config errors name keys only (never values).
  console.error(`[ops:email-test] Failed: ${err?.name === 'ConfigError' ? err.message : (err?.code ?? err?.name ?? 'Error')}`);
  process.exitCode = 1;
});
