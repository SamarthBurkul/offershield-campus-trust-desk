'use strict';

/**
 * Evidence retention (RETENTION_MONTHS, default 12).
 *   npm run ops:retention -w server               dry run: list evidence of cases closed before the cutoff
 *   npm run ops:retention -w server -- --apply    delete that evidence (cases are kept)
 * Prints case numbers and counts only.
 */
const { config } = require('../src/config/env');
const { connectDB, disconnectDB } = require('../src/config/db');
const { runRetention } = require('./lib/retention');
const { safeErrorDetail } = require('./lib/seedGuard');

async function main() {
  const apply = process.argv.includes('--apply');
  await connectDB(config.mongodbUri);
  const result = await runRetention({ months: config.retentionMonths, apply });

  const total = result.cases.reduce((sum, item) => sum + item.evidenceCount, 0);
  console.log(`[ops:retention] cutoff ${result.cutoff.toISOString()} (RETENTION_MONTHS=${config.retentionMonths})`);
  if (result.cases.length) console.table(result.cases);
  console.log(
    apply
      ? `[ops:retention] deleted ${total} evidence file(s) from ${result.cases.length} closed case(s)`
      : `[ops:retention] dry run: ${total} evidence file(s) in ${result.cases.length} closed case(s) would be deleted. Re-run with -- --apply to delete.`,
  );
}

main()
  .catch((err) => {
    console.error(`[ops:retention] Failed: ${safeErrorDetail(err)}`);
    process.exitCode = 1;
  })
  .finally(() => disconnectDB());
