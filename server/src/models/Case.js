'use strict';

const mongoose = require('mongoose');
const {
  CASE_STATUSES,
  CHANNELS,
  MONEY_PURPOSES,
  PRIORITIES,
  INDICATOR_TYPES,
  INDICATOR_SOURCES,
  DECISION_TYPES,
  DECISION_CHECKS,
  DISMISS_REASONS,
  SIGNAL_SEVERITIES,
  RELATED_REASONS,
} = require('../constants/caseStatus');

const { ObjectId } = mongoose.Schema.Types;

const maxItems = (max) => ({ validator: (items) => items.length <= max, message: `At most ${max} items` });

const isHttpUrl = (value) => {
  try {
    return ['http:', 'https:'].includes(new URL(value).protocol);
  } catch {
    return false;
  }
};

const indicatorSchema = new mongoose.Schema(
  {
    type: { type: String, enum: INDICATOR_TYPES, required: true },
    value: { type: String, required: true, maxlength: 600 },
    source: { type: String, enum: INDICATOR_SOURCES, required: true },
  },
  { _id: false },
);

const indicatorRefSchema = new mongoose.Schema(
  { type: { type: String, enum: INDICATOR_TYPES, required: true }, value: { type: String, required: true } },
  { _id: false },
);

const recommendationSchema = new mongoose.Schema(
  {
    type: { type: String, enum: DECISION_TYPES, required: true },
    basis: { type: String, required: true, maxlength: 2000 },
    by: { type: ObjectId, ref: 'User', required: true },
    at: { type: Date, required: true },
  },
  { _id: false },
);

const decisionFields = {
  type: { type: String, enum: DECISION_TYPES, required: true },
  basis: { type: String, required: true, maxlength: 3000 },
  checks: { type: [{ type: String, enum: DECISION_CHECKS }], default: [] },
  studentMessage: { type: String, maxlength: 1000, default: null },
  confirmedIndicators: { type: [indicatorRefSchema], default: [] },
  verifiedDomains: { type: [String], default: [] },
  dismissReason: { type: String, enum: [...DISMISS_REASONS, null], default: null },
  duplicateOfCaseId: { type: ObjectId, ref: 'Case', default: null },
  decidedBy: { type: ObjectId, ref: 'User', required: true },
  decidedAt: { type: Date, required: true },
};

const decisionSchema = new mongoose.Schema(decisionFields, { _id: false });

const decisionHistorySchema = new mongoose.Schema(
  {
    ...decisionFields,
    reopenedBy: { type: ObjectId, ref: 'User', required: true },
    reopenedAt: { type: Date, required: true },
    reopenReason: { type: String, required: true, maxlength: 1000 },
  },
  { _id: false },
);

// A link to another case of the same college; mirrored on both cases and kept in sync with linkedCaseIds.
const relatedSchema = new mongoose.Schema(
  {
    caseId: { type: ObjectId, ref: 'Case', required: true },
    reasons: { type: [{ type: String, enum: RELATED_REASONS }], default: [] },
    sharedIndicators: { type: [indicatorRefSchema], default: [] },
    similarity: { type: Number, min: 0, max: 1, default: null },
    linkedBy: { type: ObjectId, ref: 'User', default: null },
    detectedAt: { type: Date, required: true },
  },
  { _id: false },
);

// Staff-only triage hints. They never change status or priority and are never shown to students.
const signalSchema = new mongoose.Schema(
  {
    code: { type: String, required: true },
    severity: { type: String, enum: SIGNAL_SEVERITIES, required: true },
    message: { type: String, required: true },
    detail: { type: mongoose.Schema.Types.Mixed, default: () => ({}) },
  },
  { _id: false, minimize: false },
);

const caseSchema = new mongoose.Schema(
  {
    collegeId: { type: ObjectId, ref: 'College', required: true },
    caseNumber: { type: String, required: true, match: /^OS-[A-Z0-9-]+-\d{4,}$/ },
    studentId: { type: ObjectId, ref: 'User', required: true },

    claimedCompany: { type: String, required: true, trim: true, minlength: 2, maxlength: 120 },
    roleTitle: { type: String, trim: true, maxlength: 120, default: null },
    channel: { type: String, enum: CHANNELS, required: true },
    receivedAt: {
      type: Date,
      required: true,
      // Small allowance for client clock skew.
      validate: { validator: (date) => date.getTime() <= Date.now() + 5 * 60 * 1000, message: 'receivedAt cannot be in the future' },
    },
    messageText: { type: String, required: true, minlength: 10, maxlength: 5000 },
    // Stored as inert text. The server never fetches, resolves or previews these.
    links: {
      type: [{ type: String, maxlength: 500, validate: { validator: isHttpUrl, message: 'Only http(s) links are allowed' } }],
      default: [],
      validate: maxItems(10),
    },
    contacts: {
      emails: { type: [{ type: String, lowercase: true, trim: true, maxlength: 254 }], default: [], validate: maxItems(5) },
      phones: { type: [{ type: String, trim: true, maxlength: 20 }], default: [], validate: maxItems(5) },
      upiIds: { type: [{ type: String, lowercase: true, trim: true, maxlength: 320 }], default: [], validate: maxItems(5) },
    },
    moneyRequested: {
      requested: { type: Boolean, required: true },
      amount: { type: Number, min: 0, default: null },
      purpose: { type: String, enum: [...MONEY_PURPOSES, null], default: null },
    },
    paidAlready: { type: Boolean, required: true },
    // Yes/no only: the documents themselves are never collected.
    documentsShared: { type: Boolean, required: true },
    studentNote: { type: String, maxlength: 2000, default: null },
    consentAt: { type: Date, required: true },

    status: { type: String, enum: CASE_STATUSES, default: 'submitted' },
    priority: { type: String, enum: PRIORITIES, default: 'normal' },
    assigneeId: { type: ObjectId, ref: 'User', default: null },
    indicators: { type: [indicatorSchema], default: [] },
    // Phase 5: warning signals and related-case linking (staff-only).
    signals: { type: [signalSchema], default: [] },
    signalsComputedAt: { type: Date, default: null },
    linkedCaseIds: { type: [ObjectId], default: [] },
    related: { type: [relatedSchema], default: [] },
    // 64-bit SimHash of the normalised messageText, 16 hex characters.
    textHash: { type: String, match: /^[0-9a-f]{16}$/, default: null },
    // Officer (or head) recommendation; staff-only.
    recommendation: { type: recommendationSchema, default: null },
    // Final TPO-head decision. Phase 5 reads confirmedIndicators/verifiedDomains to build the registry.
    decision: { type: decisionSchema, default: null },
    // Earlier decisions, moved here on reopen.
    decisionHistory: { type: [decisionHistorySchema], default: [] },
    lastActivityAt: { type: Date, default: Date.now },
  },
  { timestamps: true },
);

caseSchema.index({ collegeId: 1, caseNumber: 1 }, { unique: true });
caseSchema.index({ collegeId: 1, status: 1, createdAt: -1 });
caseSchema.index({ collegeId: 1, studentId: 1, createdAt: -1 });
caseSchema.index({ collegeId: 1, 'indicators.type': 1, 'indicators.value': 1 });
caseSchema.index({ collegeId: 1, createdAt: -1, textHash: 1 });

const Case = mongoose.models.Case || mongoose.model('Case', caseSchema);

module.exports = { Case };
