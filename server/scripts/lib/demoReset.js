'use strict';

const mongoose = require('mongoose');
const { College } = require('../../src/models/College');
const { BUCKET_NAME } = require('../../src/services/storage.service');

/**
 * Delete every document belonging to a college with isDemo === true, in every collection, including
 * GridFS evidence files, counters, audit entries and notes. Colleges without isDemo: true are never
 * touched. Uses the native driver on purpose: the append-only guards protect real colleges' audit
 * trails, and a demo reset is the one sanctioned way to remove a demo college's history.
 * @returns {Promise<{ colleges: string[], deleted: Record<string, number> }>}
 */
async function resetDemoColleges() {
  const demos = await College.find({ isDemo: true }).select('_id code').lean();
  if (demos.length === 0) return { colleges: [], deleted: {} };
  const ids = demos.map((college) => college._id);
  const db = mongoose.connection.db;
  const deleted = {};

  // GridFS first: the file documents carry the college in metadata (as written by the upload: an id string).
  const bucket = new mongoose.mongo.GridFSBucket(db, { bucketName: BUCKET_NAME });
  const files = await db
    .collection(`${BUCKET_NAME}.files`)
    .find({ 'metadata.collegeId': { $in: [...ids, ...ids.map(String)] } }, { projection: { _id: 1 } })
    .toArray();
  for (const file of files) await bucket.delete(file._id);
  deleted[`${BUCKET_NAME}.files`] = files.length;

  for (const collection of await db.collections()) {
    const name = collection.collectionName;
    if (name.startsWith(`${BUCKET_NAME}.`) || name === College.collection.collectionName || name.startsWith('system.')) continue;
    const result = await collection.deleteMany({ collegeId: { $in: ids } });
    if (result.deletedCount) deleted[name] = result.deletedCount;
  }

  // The filter repeats isDemo so a college cannot be removed by id alone.
  const removed = await College.collection.deleteMany({ _id: { $in: ids }, isDemo: true });
  deleted[College.collection.collectionName] = removed.deletedCount;
  return { colleges: demos.map((college) => college.code), deleted };
}

module.exports = { resetDemoColleges };
