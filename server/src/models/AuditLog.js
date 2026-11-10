'use strict';

const mongoose = require('mongoose');
const { appendOnly } = require('./plugins/appendOnly');

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

// Append-only: block every query and document operation that would change or remove entries.
appendOnly(auditLogSchema, { name: 'AuditLog' });

const AuditLog = mongoose.models.AuditLog || mongoose.model('AuditLog', auditLogSchema);

module.exports = { AuditLog };
