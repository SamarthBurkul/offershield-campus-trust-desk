'use strict';

const mongoose = require('mongoose');

class TenantScopeError extends Error {
  constructor(message) {
    super(message);
    this.name = 'TenantScopeError';
  }
}

function assertCollegeId(collegeId) {
  if (collegeId == null || collegeId === '' || !mongoose.isValidObjectId(collegeId)) {
    // Programming error, never a client error: surfaces as a 500 INTERNAL_ERROR.
    throw new TenantScopeError('Tenant-scoped data access requires a valid collegeId');
  }
  return new mongoose.Types.ObjectId(String(collegeId));
}

function assertNoCollegeIdChange(update) {
  const touches = (obj) => obj && typeof obj === 'object' && Object.hasOwn(obj, 'collegeId');
  if (touches(update) || Object.values(update ?? {}).some(touches)) {
    throw new TenantScopeError('collegeId cannot be changed through a tenant repository');
  }
}

/**
 * Wrap a college-owned model so every query is confined to one college.
 * The session's collegeId is AND-ed into every filter and overrides any collegeId in it.
 *
 *   const users = userRepository.forTenant(req.tenant.collegeId);
 *   await users.find({ role: 'placement_officer' });
 *
 * @param {import('mongoose').Model} Model
 */
function createTenantRepository(Model) {
  function forTenant(rawCollegeId) {
    const collegeId = assertCollegeId(rawCollegeId);
    const scope = (filter = {}) => ({ ...filter, collegeId });

    return Object.freeze({
      collegeId,
      find(filter, { select, sort, limit } = {}) {
        let query = Model.find(scope(filter));
        if (select) query = query.select(select);
        if (sort) query = query.sort(sort);
        if (limit) query = query.limit(limit);
        return query.exec();
      },
      findOne(filter, { select } = {}) {
        const query = Model.findOne(scope(filter));
        return (select ? query.select(select) : query).exec();
      },
      /** Unknown, malformed and other-college ids all resolve to null (callers answer 404). */
      async findById(id, options) {
        if (!mongoose.isValidObjectId(id)) return null;
        return this.findOne({ _id: id }, options);
      },
      count(filter) {
        return Model.countDocuments(scope(filter)).exec();
      },
      updateOne(filter, update) {
        assertNoCollegeIdChange(update);
        return Model.updateOne(scope(filter), update, { runValidators: true }).exec();
      },
      deleteOne(filter) {
        return Model.deleteOne(scope(filter)).exec();
      },
      create(doc) {
        return Model.create({ ...doc, collegeId });
      },
    });
  }

  return Object.freeze({ forTenant });
}

module.exports = { createTenantRepository, TenantScopeError };
