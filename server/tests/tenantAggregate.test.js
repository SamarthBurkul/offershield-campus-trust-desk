'use strict';

const { useTestDatabase } = require('./helpers/db');
const { createCollege } = require('./helpers/factories');
const { createTenantRepository, TenantScopeError, FORBIDDEN_STAGES } = require('../src/repositories/tenantRepository');
const { LookupEvent } = require('../src/models/LookupEvent');
const mongoose = require('mongoose');

useTestDatabase();

const lookups = createTenantRepository(LookupEvent);

describe('tenantRepository.aggregate', () => {
  it('1. prepends the collegeId match so other colleges are never counted', async () => {
    const { college: a } = await createCollege({ code: 'alpha' });
    const { college: b } = await createCollege({ code: 'beta' });
    const userId = new mongoose.Types.ObjectId();
    await LookupEvent.create([
      { collegeId: a._id, userId, role: 'student', queryType: 'upi', resultStatus: 'confirmed_fraud' },
      { collegeId: a._id, userId, role: 'student', queryType: 'domain', resultStatus: 'not_reviewed' },
      { collegeId: b._id, userId, role: 'student', queryType: 'upi', resultStatus: 'confirmed_fraud' },
      { collegeId: b._id, userId, role: 'student', queryType: 'upi', resultStatus: 'confirmed_fraud' },
    ]);

    const rows = await lookups.forTenant(a._id).aggregate([{ $group: { _id: '$resultStatus', count: { $sum: 1 } } }, { $sort: { _id: 1 } }]);
    expect(rows).toEqual([
      { _id: 'confirmed_fraud', count: 1 },
      { _id: 'not_reviewed', count: 1 },
    ]);
    // Even a pipeline that tries to match the other college stays inside college A.
    const sneaky = await lookups.forTenant(a._id).aggregate([{ $match: { collegeId: b._id } }, { $count: 'n' }]);
    expect(sneaky).toEqual([]);
  });

  it.each(FORBIDDEN_STAGES)('2. refuses a pipeline containing %s', (stage) => {
    const repo = lookups.forTenant(new mongoose.Types.ObjectId());
    expect(() => repo.aggregate([{ $match: {} }, { [stage]: {} }])).toThrow(TenantScopeError);
  });

  it('2b. refuses malformed pipelines and a missing collegeId', () => {
    const repo = lookups.forTenant(new mongoose.Types.ObjectId());
    expect(() => repo.aggregate({ $match: {} })).toThrow(TenantScopeError);
    expect(() => repo.aggregate([{ $match: {}, $lookup: {} }])).toThrow(TenantScopeError);
    expect(() => lookups.forTenant(null)).toThrow(TenantScopeError);
  });
});
