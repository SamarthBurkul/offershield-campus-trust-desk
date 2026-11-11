'use strict';

const mongoose = require('mongoose');
const { INDICATOR_TYPES } = require('../constants/caseStatus');

const { ObjectId } = mongoose.Schema.Types;

/**
 * College registry of CONFIRMED fraud indicators. Written only by decision.service (publish on a
 * confirmed_fraud decision, revoke on reopen) and indicator.service (manual revoke). There is no API
 * to create one directly: an allegation never becomes a finding without a TPO-head decision.
 */
const fraudIndicatorSchema = new mongoose.Schema(
  {
    collegeId: { type: ObjectId, ref: 'College', required: true },
    type: { type: String, enum: INDICATOR_TYPES, required: true },
    value: { type: String, required: true, maxlength: 600 },
    status: { type: String, enum: ['active', 'revoked'], default: 'active' },
    sourceCaseIds: { type: [ObjectId], default: [] },
    firstConfirmedAt: { type: Date, required: true },
    lastConfirmedAt: { type: Date, required: true },
    createdBy: { type: ObjectId, ref: 'User', required: true },
    revokedAt: { type: Date, default: null },
    revokedBy: { type: ObjectId, ref: 'User', default: null },
    revokeReason: { type: String, maxlength: 500, default: null },
  },
  { timestamps: true },
);

fraudIndicatorSchema.index({ collegeId: 1, type: 1, value: 1 }, { unique: true });
fraudIndicatorSchema.index({ collegeId: 1, status: 1 });

const FraudIndicator = mongoose.models.FraudIndicator || mongoose.model('FraudIndicator', fraudIndicatorSchema);

module.exports = { FraudIndicator };
