'use strict';

const mongoose = require('mongoose');

const BUCKET_NAME = 'evidence';

/** GridFS bucket "evidence" (collections evidence.files / evidence.chunks) on the shared connection. */
function bucket() {
  return new mongoose.mongo.GridFSBucket(mongoose.connection.db, { bucketName: BUCKET_NAME });
}

/**
 * Store a buffer. metadata must carry collegeId and caseId so stored files are attributable to a tenant.
 * @returns {Promise<import('mongoose').Types.ObjectId>} the GridFS file id
 */
function saveFile(buffer, { filename, contentType, metadata }) {
  if (!metadata || !metadata.collegeId || !metadata.caseId) {
    return Promise.reject(new Error('GridFS files require collegeId and caseId metadata'));
  }
  return new Promise((resolve, reject) => {
    const upload = bucket().openUploadStream(filename, { metadata: { ...metadata, contentType } });
    upload.once('error', reject);
    upload.once('finish', () => resolve(upload.id));
    upload.end(buffer);
  });
}

/** Readable stream of a stored file. Callers must have authorised access through the Evidence record. */
function openFileStream(gridFsId) {
  return bucket().openDownloadStream(gridFsId);
}

async function deleteFile(gridFsId) {
  try {
    await bucket().delete(gridFsId);
  } catch {
    // Best-effort cleanup; a missing file is already gone.
  }
}

module.exports = { BUCKET_NAME, saveFile, openFileStream, deleteFile };
