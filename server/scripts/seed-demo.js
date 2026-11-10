'use strict';

/**
 * Idempotently create two demo colleges with staff and students, all using SEED_DEMO_PASSWORD.
 * Usage: npm run seed:demo -w server
 * Refuses to run in production. Prints emails, roles and the demo join codes, never passwords.
 */
const { config } = require('../src/config/env');
const { connectDB, disconnectDB } = require('../src/config/db');
const { College } = require('../src/models/College');
const { User, ROLES } = require('../src/models/User');
const { hashPassword, verifyPassword, isPasswordAcceptable } = require('../src/utils/password');
const { normalizeJoinCode } = require('../src/utils/tokens');

// Fixed, public demo values. Not secrets: they exist only for local demos.
const DEMO_COLLEGES = [
  {
    code: 'demo-alpha',
    name: 'Demo Alpha Institute of Technology',
    domain: 'alpha.demo.edu',
    joinCode: 'ALPHA-DEMO-2026',
  },
  {
    code: 'demo-beta',
    name: 'Demo Beta College of Engineering',
    domain: 'beta.demo.edu',
    joinCode: 'BETA-DEMO-2026',
  },
];

function demoUsers(domain, label) {
  return [
    { role: ROLES.TPO_HEAD, name: `${label} TPO Head`, email: `tpo.head@${domain}` },
    { role: ROLES.PLACEMENT_OFFICER, name: `${label} Placement Officer`, email: `placement.officer@${domain}` },
    { role: ROLES.STUDENT, name: `${label} Student One`, email: `student1@${domain}`, year: 3, branch: 'COMP' },
    { role: ROLES.STUDENT, name: `${label} Student Two`, email: `student2@${domain}`, year: 4, branch: 'IT' },
  ];
}

async function ensureCollege(spec) {
  let college = await College.findOne({ code: spec.code }).select('+studentJoinCodeHash');
  if (college) {
    const joinCodeValid = await verifyPassword(normalizeJoinCode(spec.joinCode), college.studentJoinCodeHash);
    console.log(
      `  college ${spec.code}: already exists${joinCodeValid ? '' : ' (join code was rotated; the demo join code no longer works)'}`,
    );
    return college;
  }
  college = await College.create({
    name: spec.name,
    code: spec.code,
    emailDomains: [spec.domain],
    studentJoinCodeHash: await hashPassword(normalizeJoinCode(spec.joinCode)),
  });
  console.log(`  college ${spec.code}: created`);
  return college;
}

async function main() {
  if (config.isProduction) throw new Error('Refusing to seed demo data when NODE_ENV=production');
  const { demoPassword } = config.seed;
  if (!demoPassword) throw new Error('SEED_DEMO_PASSWORD must be set in server/.env');
  if (!isPasswordAcceptable(demoPassword)) {
    throw new Error('SEED_DEMO_PASSWORD does not meet the password policy (10+ chars, a letter and a number)');
  }

  await connectDB(config.mongodbUri);
  const passwordHash = await hashPassword(demoPassword);
  const summary = [];

  for (const spec of DEMO_COLLEGES) {
    const college = await ensureCollege(spec);
    const label = spec.code === 'demo-alpha' ? 'Alpha' : 'Beta';
    for (const account of demoUsers(spec.domain, label)) {
      const exists = await User.exists({ email: account.email });
      if (!exists) {
        await User.create({ ...account, collegeId: college._id, passwordHash, mustChangePassword: false });
      }
      summary.push({ college: spec.code, role: account.role, email: account.email, result: exists ? 'exists' : 'created' });
    }
  }

  console.log('\n[seed:demo] Accounts (password: the SEED_DEMO_PASSWORD value from server/.env)');
  console.table(summary);
  console.log('[seed:demo] Student join codes (demo only):');
  for (const spec of DEMO_COLLEGES) console.log(`  ${spec.code}: ${spec.joinCode}`);
}

main()
  .catch((err) => {
    // Driver errors can mention hosts, so only this script's own messages are printed in full.
    const detail = err.name === 'Error' ? err.message : err.name;
    console.error(`[seed:demo] Failed: ${detail}`);
    process.exitCode = 1;
  })
  .finally(() => disconnectDB());
