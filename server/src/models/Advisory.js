'use strict';

const mongoose = require('mongoose');

const { ObjectId } = mongoose.Schema.Types;

const ADVISORY_SEVERITIES = Object.freeze(['info', 'warning', 'critical']);
const ADVISORY_STATUSES = Object.freeze(['draft', 'published', 'withdrawn']);

// A campus advisory built from confirmed findings. Drafted by staff, published (and then immutable) by the TPO head.
const advisorySchema = new mongoose.Schema(
  {
    collegeId: { type: ObjectId, ref: 'College', required: true },
    title: { type: String, required: true, trim: true, minlength: 5, maxlength: 120 },
    body: { type: String, required: true, trim: true, minlength: 20, maxlength: 3000 },
    severity: { type: String, enum: ADVISORY_SEVERITIES, default: 'warning' },
    // Empty arrays mean "all years" / "all branches".
    target: {
      years: { type: [{ type: Number, min: 1, max: 5 }], default: [] },
      branches: { type: [{ type: String, uppercase: true, trim: true }], default: [] },
    },
    indicatorIds: {
      type: [{ type: ObjectId, ref: 'FraudIndicator' }],
      default: [],
      validate: { validator: (ids) => ids.length <= 20, message: 'At most 20 indicators' },
    },
    sourceCaseId: { type: ObjectId, ref: 'Case', default: null },
    status: { type: String, enum: ADVISORY_STATUSES, default: 'draft' },
    createdBy: { type: ObjectId, ref: 'User', required: true },
    updatedBy: { type: ObjectId, ref: 'User', default: null },
    publishedBy: { type: ObjectId, ref: 'User', default: null },
    publishedAt: { type: Date, default: null },
    // Number of students notified at publish time (denominator of the acknowledgement rate).
    audienceCountAtPublish: { type: Number, min: 0, default: null },
    withdrawnBy: { type: ObjectId, ref: 'User', default: null },
    withdrawnAt: { type: Date, default: null },
    withdrawReason: { type: String, maxlength: 500, default: null },
    expiresAt: { type: Date, default: null },
  },
  { timestamps: true },
);

advisorySchema.index({ collegeId: 1, status: 1, publishedAt: -1 });

const Advisory = mongoose.models.Advisory || mongoose.model('Advisory', advisorySchema);

module.exports = { Advisory, ADVISORY_SEVERITIES, ADVISORY_STATUSES };
