'use strict';

const { AuditLog } = require('../models/AuditLog');

// Metadata must never carry credentials. Matching keys are dropped as a last line of defence.
const SECRET_KEY_PATTERN = /pass|hash|token|secret|joincode|join_code|cookie/i;

function sanitizeMetadata(value) {
  if (Array.isArray(value)) return value.map(sanitizeMetadata);
  if (value && typeof value === 'object' && !(value instanceof Date)) {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([key]) => !SECRET_KEY_PATTERN.test(key))
        .map(([key, nested]) => [key, sanitizeMetadata(nested)]),
    );
  }
  return value;
}

/**
 * Append one audit entry. Called by services after the audited action has succeeded.
 * @param {{ collegeId?: any, actor?: { id: string, role: string } | null, action: string,
 *           entityType: string, entityId?: any, metadata?: object, ip?: string | null }} entry
 */
async function record({ collegeId = null, actor = null, action, entityType, entityId = null, metadata = {}, ip = null }) {
  await AuditLog.create({
    collegeId,
    actorId: actor?.id ?? null,
    actorRole: actor?.role ?? null,
    action,
    entityType,
    entityId,
    metadata: sanitizeMetadata(metadata),
    ip,
  });
}

module.exports = { record, sanitizeMetadata };
