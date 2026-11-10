'use strict';

const mongoose = require('mongoose');
const { CASE_EVENT_TYPES } = require('../constants/caseStatus');

const { ObjectId } = mongoose.Schema.Types;

// Case timeline. Staff-only internal notes are NOT stored here (separate collection in Phase 4).
const caseEventSchema = new mongoose.Schema(
  {
    collegeId: { type: ObjectId, ref: 'College', required: true },
    caseId: { type: ObjectId, ref: 'Case', required: true },
    type: { type: String, enum: CASE_EVENT_TYPES, required: true },
    actorId: { type: ObjectId, ref: 'User', default: null },
    actorRole: { type: String, default: null },
    body: { type: String, maxlength: 3000, default: null },
    // Deliberately no default: every writer must decide whether the student may see the event.
    visibleToStudent: { type: Boolean, required: true },
    metadata: { type: mongoose.Schema.Types.Mixed, default: () => ({}) },
  },
  { timestamps: { createdAt: true, updatedAt: false }, minimize: false },
);

caseEventSchema.index({ collegeId: 1, caseId: 1, createdAt: 1 });

const CaseEvent = mongoose.models.CaseEvent || mongoose.model('CaseEvent', caseEventSchema);

module.exports = { CaseEvent };
