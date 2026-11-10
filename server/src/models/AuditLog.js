'use strict';

const mongoose = require('mongoose');

const auditLogSchema = new mongoose.Schema(
  {
    // null for platform-level actions (e.g. super_admin onboarding work outside a college).
    collegeId: { type: mongoose.Schema.Types.ObjectId, ref: 'College', default: null, index: true },
    actorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    actorRole: { type: String, default: null },
    action: { type: String, required: true, maxlength: 100 },
    entityType: { type: String, required: true, maxlength: 50 },
    entityId: { type: mongoose.Schema.Types.ObjectId, default: null },
    metadata: { type: mongoose.Schema.Types.Mixed, default: () => ({}) },
    ip: { type: String, default: null },
  },
  { timestamps: { createdAt: true, updatedAt: false }, minimize: false },
);

auditLogSchema.index({ collegeId: 1, createdAt: -1 });

function rejectMutation() {
  throw new Error('AuditLog is append-only');
}

// Append-only: block every query and document operation that would change or remove entries.
const BLOCKED_QUERY_OPS = [
  'updateOne',
  'updateMany',
  'findOneAndUpdate',
  'findOneAndReplace',
  'findOneAndDelete',
  'replaceOne',
  'deleteOne',
  'deleteMany',
];
for (const op of BLOCKED_QUERY_OPS) {
  auditLogSchema.pre(op, { document: false, query: true }, rejectMutation);
}
auditLogSchema.pre(['updateOne', 'deleteOne'], { document: true, query: false }, rejectMutation);
auditLogSchema.pre('save', function rejectResave() {
  if (!this.isNew) rejectMutation();
});
auditLogSchema.pre('bulkWrite', rejectMutation);

const AuditLog = mongoose.models.AuditLog || mongoose.model('AuditLog', auditLogSchema);

module.exports = { AuditLog };
