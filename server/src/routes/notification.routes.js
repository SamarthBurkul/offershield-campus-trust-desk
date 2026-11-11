'use strict';

const { Router } = require('express');
const controller = require('../controllers/notification.controller');
const { enforcePasswordChange } = require('../middleware/enforcePasswordChange');
const { requireRole } = require('../middleware/requireRole');
const { requireTenant } = require('../middleware/requireTenant');
const { validateBody, validateQuery } = require('../middleware/validate');
const { notificationListQuerySchema } = require('../validators/notification.schemas');
const { emptyBodySchema } = require('../validators/admin.schemas');

/** Mounted at /notifications. Any college user; the super admin has no tenant (403). */
function createNotificationRouter({ authenticate }) {
  const router = Router();
  router.use(authenticate, enforcePasswordChange, requireTenant, requireRole('student', 'placement_officer', 'tpo_head'));
  router.get('/', validateQuery(notificationListQuerySchema), controller.list);
  router.get('/unread-count', controller.unreadCount);
  router.post('/read-all', validateBody(emptyBodySchema), controller.markAllRead);
  router.post('/:id/read', validateBody(emptyBodySchema), controller.markRead);
  return router;
}

module.exports = { createNotificationRouter };
