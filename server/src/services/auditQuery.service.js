'use strict';

const { auditLogRepository } = require('../repositories');
const { usersById } = require('./staffCase.service');
const { idOf } = require('../utils/safeUser');

/** College-scoped audit trail for the TPO head, newest first. */
async function listAuditEntries(user, query) {
  const filter = {};
  if (query.action) filter.action = query.action;
  if (query.entityType) filter.entityType = query.entityType;
  if (query.entityId) filter.entityId = query.entityId;
  if (query.actorId) filter.actorId = query.actorId;
  if (query.from || query.to) {
    filter.createdAt = {};
    if (query.from) filter.createdAt.$gte = query.from;
    if (query.to) filter.createdAt.$lte = query.to;
  }

  const entries = auditLogRepository.forTenant(user.collegeId);
  const [items, total] = await Promise.all([
    entries.find(filter, { sort: { createdAt: -1, _id: -1 }, skip: (query.page - 1) * query.limit, limit: query.limit, lean: true }),
    entries.count(filter),
  ]);
  // College users resolve by name; platform actors (super admin) are not college users.
  const people = await usersById(user.collegeId, items.map((item) => item.actorId));

  return {
    entries: items.map((item) => ({
      id: idOf(item._id),
      actor: {
        id: idOf(item.actorId),
        name: people.get(String(item.actorId))?.name ?? (item.actorRole === 'super_admin' ? 'Platform administrator' : null),
        role: item.actorRole,
      },
      action: item.action,
      entity: { type: item.entityType, id: idOf(item.entityId) },
      metadata: item.metadata ?? {},
      createdAt: item.createdAt.toISOString(),
    })),
    page: query.page,
    limit: query.limit,
    total,
  };
}

module.exports = { listAuditEntries };
