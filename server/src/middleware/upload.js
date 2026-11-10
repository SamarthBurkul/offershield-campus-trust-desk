'use strict';

const multer = require('multer');
const AppError = require('../utils/AppError');
const { EVIDENCE_LIMITS } = require('../constants/caseStatus');

// Files stay in memory (max 5 x 3 MB) and are validated by content before anything is stored.
const evidenceUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: EVIDENCE_LIMITS.maxFileBytes,
    files: EVIDENCE_LIMITS.maxFilesPerRequest,
    fields: 0,
    parts: EVIDENCE_LIMITS.maxFilesPerRequest + 2,
  },
}).array('files', EVIDENCE_LIMITS.maxFilesPerRequest);

function toAppError(err) {
  if (!(err instanceof multer.MulterError)) return err;
  switch (err.code) {
    case 'LIMIT_FILE_SIZE':
      return new AppError(413, 'FILE_TOO_LARGE', 'Each file must be 3 MB or smaller');
    case 'LIMIT_FILE_COUNT':
    case 'LIMIT_UNEXPECTED_FILE':
    case 'LIMIT_PART_COUNT':
      return new AppError(400, 'TOO_MANY_FILES', `Upload at most ${EVIDENCE_LIMITS.maxFilesPerRequest} files at a time in the "files" field`);
    default:
      return new AppError(400, 'INVALID_UPLOAD', 'The upload could not be read');
  }
}

/** multer wrapper mapping its errors to the standard envelope. */
function uploadEvidenceFiles(req, res, next) {
  evidenceUpload(req, res, (err) => next(err ? toAppError(err) : undefined));
}

module.exports = { uploadEvidenceFiles };
