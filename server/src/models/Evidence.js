'use strict';

const mongoose = require('mongoose');

const { ObjectId } = mongoose.Schema.Types;

const EVIDENCE_MIME_TYPES = Object.freeze(['image/png', 'image/jpeg', 'application/pdf']);

// Metadata for one evidence file. The bytes live in the GridFS bucket "evidence".
const evidenceSchema = new mongoose.Schema(
  {
    collegeId: { type: ObjectId, ref: 'College', required: true },
    caseId: { type: ObjectId, ref: 'Case', required: true },
    uploadedBy: { type: ObjectId, ref: 'User', required: true },
    originalName: { type: String, required: true, maxlength: 100 },
    mime: { type: String, enum: EVIDENCE_MIME_TYPES, required: true },
    size: { type: Number, required: true, min: 1 },
    sha256: { type: String, required: true, match: /^[a-f0-9]{64}$/ },
    gridFsId: { type: ObjectId, required: true },
    metadataStripped: { type: Boolean, required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

evidenceSchema.index({ collegeId: 1, caseId: 1, createdAt: 1 });

const Evidence = mongoose.models.Evidence || mongoose.model('Evidence', evidenceSchema);

module.exports = { Evidence, EVIDENCE_MIME_TYPES };
