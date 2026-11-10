'use strict';

const bcrypt = require('bcrypt');
const { z } = require('zod');

const BCRYPT_COST = 12;
// bcrypt only uses the first 72 bytes of its input, so longer passwords are rejected rather than truncated.
const BCRYPT_MAX_BYTES = 72;

const passwordSchema = z
  .string()
  .min(10, { error: 'must be at least 10 characters' })
  .refine((value) => Buffer.byteLength(value, 'utf8') <= BCRYPT_MAX_BYTES, { error: 'must be at most 72 bytes' })
  .refine((value) => /\p{L}/u.test(value), { error: 'must contain at least one letter' })
  .refine((value) => /\p{N}/u.test(value), { error: 'must contain at least one number' });

function isPasswordAcceptable(value) {
  return passwordSchema.safeParse(value).success;
}

function hashPassword(plain) {
  return bcrypt.hash(plain, BCRYPT_COST);
}

function verifyPassword(plain, hash) {
  return bcrypt.compare(plain, hash);
}

// A valid hash of a random value, compared against when no account matches,
// so unknown-email and wrong-password logins take about the same time.
let dummyHashPromise;
function verifyAgainstDummy(plain) {
  dummyHashPromise ??= bcrypt.hash(`dummy-${Math.random()}`, BCRYPT_COST);
  return dummyHashPromise.then((hash) => bcrypt.compare(plain, hash)).then(() => false);
}

module.exports = { BCRYPT_COST, passwordSchema, isPasswordAcceptable, hashPassword, verifyPassword, verifyAgainstDummy };
