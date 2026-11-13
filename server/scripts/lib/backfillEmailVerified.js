'use strict';

const { User } = require('../../src/models/User');

/**
 * Phase 9 backfill (idempotent):
 *  - accounts created before email verification existed count as verified from their creation date;
 *    accounts waiting on an emailed code (emailOtp present) are left alone
 *  - accounts without authMethods get ['password']
 * Uses the raw collection: this is a platform-wide maintenance step, not a tenant request.
 */
async function backfillEmailVerified() {
  const collection = User.collection;
  const verified = await collection.updateMany(
    { $or: [{ emailVerifiedAt: null }, { emailVerifiedAt: { $exists: false } }], emailOtp: { $exists: false } },
    [{ $set: { emailVerifiedAt: { $ifNull: ['$createdAt', '$$NOW'] } } }],
  );
  const methods = await collection.updateMany(
    { $or: [{ authMethods: { $exists: false } }, { authMethods: { $size: 0 } }] },
    { $set: { authMethods: ['password'] } },
  );
  return { emailVerifiedSet: verified.modifiedCount, authMethodsSet: methods.modifiedCount };
}

module.exports = { backfillEmailVerified };
