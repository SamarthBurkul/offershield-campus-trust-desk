'use strict';

const mongoose = require('mongoose');
const {
  CASE_STATUSES,
  CHANNELS,
  MONEY_PURPOSES,
  PRIORITIES,
  INDICATOR_TYPES,
  INDICATOR_SOURCES,
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
    // Filled in Phase 5 (warning signals and related-case linking).
    signals: { type: [mongoose.Schema.Types.Mixed], default: [] },
    linkedCaseIds: { type: [ObjectId], default: [] },
    // Filled in Phase 4: { type, basis, decidedBy, decidedAt }.
    decision: {
      type: new mongoose.Schema(
        {
          type: { type: String, required: true },
          basis: { type: String, required: true, maxlength: 3000 },
          decidedBy: { type: ObjectId, ref: 'User', required: true },
          decidedAt: { type: Date, required: true },
        },
        { _id: false },
      ),
      default: null,
    },
    lastActivityAt: { type: Date, default: Date.now },
  },
  { timestamps: true },
);

caseSchema.index({ collegeId: 1, caseNumber: 1 }, { unique: true });
caseSchema.index({ collegeId: 1, status: 1, createdAt: -1 });
caseSchema.index({ collegeId: 1, studentId: 1, createdAt: -1 });
caseSchema.index({ collegeId: 1, 'indicators.type': 1, 'indicators.value': 1 });

const Case = mongoose.models.Case || mongoose.model('Case', caseSchema);

module.exports = { Case };
