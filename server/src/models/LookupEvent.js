'use strict';

const mongoose = require('mongoose');

const { ObjectId } = mongoose.Schema.Types;

// Lookup metrics only. The query text is deliberately never stored.
const lookupEventSchema = new mongoose.Schema(
  {
    collegeId: { type: ObjectId, ref: 'College', required: true },
    userId: { type: ObjectId, ref: 'User', required: true },
    role: { type: String, required: true },
    queryType: { type: String, enum: ['email', 'upi', 'phone', 'url', 'domain', 'company'], required: true },
    resultStatus: {
      type: String,
      enum: ['confirmed_fraud', 'lookalike_warning', 'verified', 'verified_expired', 'not_reviewed'],
      required: true,
    },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

lookupEventSchema.index({ collegeId: 1, createdAt: -1 });

const LookupEvent = mongoose.models.LookupEvent || mongoose.model('LookupEvent', lookupEventSchema);

module.exports = { LookupEvent };
