'use strict';

const mongoose = require('mongoose');

const { ObjectId } = mongoose.Schema.Types;

const EMAIL_TYPES = Object.freeze([
  'verify_email',
  'password_reset',
  'password_reset_google',
  'password_changed',
  'case_info_requested',
  'case_staff_message',
  'case_decision',
  'case_reopened',
  'advisory_published',
  'case_submitted',
  'student_pending',
]);
const EMAIL_STATUSES = Object.freeze(['sent', 'skipped_budget', 'skipped_pref', 'failed']);
const EMAIL_LOG_TTL_SECONDS = 90 * 24 * 60 * 60;

// Delivery record only. Never stores the body, recipient address, codes, links or tokens.
const emailLogSchema = new mongoose.Schema(
  {
    collegeId: { type: ObjectId, ref: 'College', default: null },
    userId: { type: ObjectId, ref: 'User', required: true },
    type: { type: String, enum: EMAIL_TYPES, required: true },
    priority: { type: String, enum: ['critical', 'normal'], required: true },
    status: { type: String, enum: EMAIL_STATUSES, required: true },
    providerMessageId: { type: String, maxlength: 200, default: null },
    // Error code only (e.g. BREVO_5XX), never a provider message.
    errorCode: { type: String, maxlength: 40, default: null },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

emailLogSchema.index({ status: 1, createdAt: -1 });
emailLogSchema.index({ createdAt: 1 }, { expireAfterSeconds: EMAIL_LOG_TTL_SECONDS });

const EmailLog = mongoose.models.EmailLog || mongoose.model('EmailLog', emailLogSchema);

module.exports = { EmailLog, EMAIL_TYPES, EMAIL_STATUSES, EMAIL_LOG_TTL_SECONDS };
