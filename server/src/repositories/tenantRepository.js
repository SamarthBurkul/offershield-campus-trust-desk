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

// Stages that can read or write other collections (and so other tenants), or hide them inside sub-pipelines.
const FORBIDDEN_STAGES = Object.freeze(['$lookup', '$graphLookup', '$unionWith', '$out', '$merge', '$facet']);

function assertSafePipeline(pipeline) {
  if (!Array.isArray(pipeline)) throw new TenantScopeError('Aggregation pipeline must be an array');
  for (const stage of pipeline) {
    const name = stage && typeof stage === 'object' ? Object.keys(stage)[0] : null;
    if (!name || Object.keys(stage).length !== 1) throw new TenantScopeError('Each pipeline stage must have exactly one operator');
    if (FORBIDDEN_STAGES.includes(name)) {
      throw new TenantScopeError(`${name} is not allowed in tenant aggregations; run a second scoped query instead`);
    }
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
      find(filter, { select, sort, skip, limit, lean } = {}) {
        let query = Model.find(scope(filter));
        if (select) query = query.select(select);
        if (sort) query = query.sort(sort);
        if (skip) query = query.skip(skip);
        if (limit) query = query.limit(limit);
        if (lean) query = query.lean();
        return query.exec();
      },
      findOne(filter, { select, lean } = {}) {
        let query = Model.findOne(scope(filter));
        if (select) query = query.select(select);
        if (lean) query = query.lean();
        return query.exec();
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
      /**
       * Atomic conditional update. Returns the document after (default) or before the update, or null
       * when nothing matched. With upsert, the inserted document gets this collegeId.
       */
      findOneAndUpdate(filter, update, { upsert = false, returnDocument = 'after' } = {}) {
        assertNoCollegeIdChange(update);
        return Model.findOneAndUpdate(scope(filter), update, {
          upsert,
          returnDocument,
          runValidators: true,
          setDefaultsOnInsert: true,
        }).exec();
      },
      updateMany(filter, update) {
        assertNoCollegeIdChange(update);
        return Model.updateMany(scope(filter), update, { runValidators: true }).exec();
      },
      deleteOne(filter) {
        return Model.deleteOne(scope(filter)).exec();
      },
      deleteMany(filter) {
        return Model.deleteMany(scope(filter)).exec();
      },
      /**
       * Aggregation confined to this college: { $match: { collegeId } } is always the first stage, and
       * stages that could reach other collections are refused.
       */
      aggregate(pipeline) {
        assertSafePipeline(pipeline);
        return Model.aggregate([{ $match: { collegeId } }, ...pipeline]).exec();
      },
      insertMany(docs) {
        return Model.insertMany(docs.map((doc) => ({ ...doc, collegeId })), { ordered: false });
      },
      create(doc) {
        return Model.create({ ...doc, collegeId });
      },
    });
  }

  return Object.freeze({ forTenant });
}

module.exports = { createTenantRepository, TenantScopeError, FORBIDDEN_STAGES };
