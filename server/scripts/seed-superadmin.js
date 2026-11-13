'use strict';

/**
 * Idempotently create the platform super admin from SEED_SUPERADMIN_EMAIL / SEED_SUPERADMIN_PASSWORD.
 * Usage: npm run seed:superadmin -w server
 * Never prints the email or password.
 */
const { config } = require('../src/config/env');
const { connectDB, disconnectDB } = require('../src/config/db');
const { User, ROLES } = require('../src/models/User');
const { hashPassword, isPasswordAcceptable } = require('../src/utils/password');

async function main() {
  const { superadminEmail, superadminPassword } = config.seed;
  if (!superadminEmail || !superadminPassword) {
    throw new Error('SEED_SUPERADMIN_EMAIL and SEED_SUPERADMIN_PASSWORD must be set in server/.env');
  }
  if (!isPasswordAcceptable(superadminPassword)) {
    throw new Error('SEED_SUPERADMIN_PASSWORD does not meet the password policy (10+ chars, a letter and a number)');
  }

  await connectDB(config.mongodbUri);
  const email = superadminEmail.trim().toLowerCase();
  const existing = await User.findOne({ email }).select('role').lean();

  if (existing) {
    if (existing.role !== ROLES.SUPER_ADMIN) {
      throw new Error('An account with SEED_SUPERADMIN_EMAIL already exists with a different role; nothing changed');
    }
    console.log('[seed:superadmin] Super admin already exists; nothing changed.');
    return;
  }

  await User.create({
    role: ROLES.SUPER_ADMIN,
    collegeId: null,
    name: 'Platform Super Admin',
    email,
    passwordHash: await hashPassword(superadminPassword),
    mustChangePassword: false,
    emailVerifiedAt: new Date(),
  });
  console.log('[seed:superadmin] Super admin created (email and password taken from server/.env).');
}

main()
  .catch((err) => {
    // Driver errors can mention hosts, so only this script's own messages are printed in full.
    const detail = err.name === 'Error' ? err.message : err.name;
    console.error(`[seed:superadmin] Failed: ${detail}`);
    process.exitCode = 1;
  })
  .finally(() => disconnectDB());
