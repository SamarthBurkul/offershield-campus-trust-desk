'use strict';

const notifications = require('../services/notifications/notify');

module.exports = {
  async list(req, res) {
    res.status(200).json(await notifications.listNotifications(req.user, req.validatedQuery));
  },
  async unreadCount(req, res) {
    res.status(200).json({ unreadCount: await notifications.unreadCount(req.user) });
  },
  async markRead(req, res) {
    await notifications.markRead(req.user, req.params.id);
    res.status(200).json({ read: true });
  },
  async markAllRead(req, res) {
    res.status(200).json({ updated: await notifications.markAllRead(req.user) });
  },
};
