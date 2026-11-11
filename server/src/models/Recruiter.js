'use strict';

const mongoose = require('mongoose');
const { DECISION_CHECKS } = require('../constants/caseStatus');

const { ObjectId } = mongoose.Schema.Types;

const RECRUITER_STATUSES = Object.freeze(['pending_approval', 'verified', 'suspended']);
// Verification methods reuse the decision checks vocabulary.
const VERIFICATION_METHODS = DECISION_CHECKS;

const verificationFields = {
  methods: {
    type: [{ type: String, enum: VERIFICATION_METHODS }],
    validate: { validator: (methods) => methods.length >= 1, message: 'At least one verification method is required' },
  },
  evidenceNote: { type: String, required: true, minlength: 20, maxlength: 2000 },
  // Set when the TPO head verifies; null while pending approval.
  verifiedBy: { type: ObjectId, ref: 'User', default: null },
  verifiedAt: { type: Date, default: null },
  expiresAt: { type: Date, default: null },
  // Requested validity, applied when a pending record is approved.
  validForDays: { type: Number, min: 30, max: 730, required: true },
};

const verificationSchema = new mongoose.Schema(verificationFields, { _id: false });
const verificationHistorySchema = new mongoose.Schema(
  { ...verificationFields, replacedAt: { type: Date, required: true }, replacedBy: { type: ObjectId, ref: 'User', required: true } },
  { _id: false },
);

const recruiterSchema = new mongoose.Schema(
  {
    collegeId: { type: ObjectId, ref: 'College', required: true },
    companyName: { type: String, required: true, trim: true, minlength: 2, maxlength: 120 },
    domains: {
      type: [{ type: String, lowercase: true, trim: true, maxlength: 253 }],
      validate: { validator: (domains) => domains.length >= 1 && domains.length <= 20, message: '1-20 domains are required' },
    },
    contactEmails: {
      type: [{ type: String, lowercase: true, trim: true, maxlength: 254 }],
      default: [],
      validate: { validator: (items) => items.length <= 10, message: 'At most 10 contact emails' },
    },
    contactPhones: {
      type: [{ type: String, trim: true, maxlength: 20 }],
      default: [],
      validate: { validator: (items) => items.length <= 10, message: 'At most 10 contact phones' },
    },
    status: { type: String, enum: RECRUITER_STATUSES, default: 'pending_approval' },
    verification: { type: verificationSchema, required: true },
    verificationHistory: { type: [verificationHistorySchema], default: [] },
    sourceCaseId: { type: ObjectId, ref: 'Case', default: null },
    createdBy: { type: ObjectId, ref: 'User', required: true },
    suspendedReason: { type: String, maxlength: 500, default: null },
  },
  { timestamps: true, toJSON: { virtuals: true }, toObject: { virtuals: true } },
);

recruiterSchema.virtual('isExpired').get(function isExpired() {
  return this.status === 'verified' && Boolean(this.verification?.expiresAt) && this.verification.expiresAt < new Date();
});

recruiterSchema.index({ collegeId: 1, status: 1 });
recruiterSchema.index({ collegeId: 1, domains: 1 });
recruiterSchema.index({ collegeId: 1, contactEmails: 1 });
recruiterSchema.index({ collegeId: 1, contactPhones: 1 });

const Recruiter = mongoose.models.Recruiter || mongoose.model('Recruiter', recruiterSchema);

module.exports = { Recruiter, RECRUITER_STATUSES, VERIFICATION_METHODS };
