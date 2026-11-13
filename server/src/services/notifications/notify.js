'use strict';

const { isValidObjectId } = require('mongoose');
const AppError = require('../../utils/AppError');
const { notificationRepository, userRepository } = require('../../repositories');
const { STAFF_ROLES } = require('../../models/User');
const { render } = require('./templates');
const { idOf } = require('../../utils/safeUser');
const email = require('../email');

const BATCH_SIZE = 500;
const INTERNAL_LINK = /^\/(?!\/)[A-Za-z0-9/_-]*$/;

/**
 * Create one notification per recipient (batched insertMany). Text comes only from templates; callers
 * pass the template `context` (allow-listed fields) and never free text.
 * @param {string} collegeId
 * @param {string[]} userIds recipients; `excludeUserId` (the actor) is always removed
 * @param {{ type: string, context: object, link: string, refType: 'case'|'advisory'|'user', refId: any, excludeUserId?: string }} options
 */
async function notify(collegeId, userIds, { type, context, link, refType, refId, excludeUserId = null }) {
  if (!INTERNAL_LINK.test(link)) throw new Error('Notification links must be internal paths');
  const recipients = [...new Set(userIds.map(String))].filter((id) => id !== String(excludeUserId));
  if (recipients.length === 0) return 0;
  const { title, body } = render(type, context);
  const repo = notificationRepository.forTenant(collegeId);
  for (let i = 0; i < recipients.length; i += BATCH_SIZE) {
    await repo.insertMany(recipients.slice(i, i + BATCH_SIZE).map((userId) => ({ userId, type, title, body, link, refType, refId })));
  }
  // Email copies (only for the email-enabled types) run in the background and never fail this call.
  email.queueNotificationEmails(collegeId, recipients, { type, context, link, refType, refId });
  return recipients.length;
}

const api = {
  notify,
  /**
   * Notification failures must never fail the main action: errors are swallowed and only the error
   * name/code is logged.
   */
  async notifySafely(...args) {
    try {
      return await api.notify(...args);
    } catch (err) {
      console.error(`[notify] failed: ${err?.code ?? err?.name ?? 'Error'}`);
      return 0;
    }
  },

  async activeStaffIds(collegeId, roles = STAFF_ROLES) {
    const staff = await userRepository.forTenant(collegeId).find({ role: { $in: roles }, status: 'active' }, { select: '_id', lean: true });
    return staff.map((user) => String(user._id));
  },
};

// ------------------------------------------------------------------------------------------------
// Notification inbox API (always scoped by collegeId AND userId).

const view = (item) => ({
  id: idOf(item._id),
  type: item.type,
  title: item.title,
  body: item.body,
  link: item.link,
  read: Boolean(item.readAt),
  createdAt: item.createdAt.toISOString(),
});

async function listNotifications(user, { unread, page, limit }) {
  const filter = { userId: user.id, ...(unread ? { readAt: null } : {}) };
  const repo = notificationRepository.forTenant(user.collegeId);
  const [items, total, unreadCount] = await Promise.all([
    repo.find(filter, { sort: { createdAt: -1, _id: -1 }, skip: (page - 1) * limit, limit, lean: true }),
    repo.count(filter),
    repo.count({ userId: user.id, readAt: null }),
  ]);
  return { notifications: items.map(view), page, limit, total, unreadCount };
}

async function unreadCount(user) {
  return notificationRepository.forTenant(user.collegeId).count({ userId: user.id, readAt: null });
}

async function markRead(user, id) {
  if (!isValidObjectId(id)) throw new AppError(404, 'NOT_FOUND', 'Notification not found');
  const repo = notificationRepository.forTenant(user.collegeId);
  const result = await repo.updateOne({ _id: id, userId: user.id, readAt: null }, { $set: { readAt: new Date() } });
  if (result.matchedCount === 0 && !(await repo.findOne({ _id: id, userId: user.id }, { lean: true }))) {
    throw new AppError(404, 'NOT_FOUND', 'Notification not found');
  }
}

async function markAllRead(user) {
  const result = await notificationRepository
    .forTenant(user.collegeId)
    .updateMany({ userId: user.id, readAt: null }, { $set: { readAt: new Date() } });
  return result.modifiedCount;
}

/** Was this user notified about this advisory? (Lets notified students see a withdrawn state.) */
async function wasNotifiedAbout(user, refType, refId) {
  const found = await notificationRepository.forTenant(user.collegeId).findOne({ userId: user.id, refType, refId }, { lean: true });
  return Boolean(found);
}

module.exports = Object.assign(api, { listNotifications, unreadCount, markRead, markAllRead, wasNotifiedAbout, BATCH_SIZE });
