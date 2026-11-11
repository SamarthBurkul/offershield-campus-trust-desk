'use strict';

const { Router } = require('express');
const { createStatsController } = require('../controllers/stats.controller');
const { requireRole } = require('../middleware/requireRole');
const { validateQuery } = require('../middleware/validate');
const { statsQuerySchema } = require('../validators/stats.schemas');

/** Mounted at /staff/stats inside the staff router (authenticate → enforcePasswordChange → requireTenant). */
function createStatsRouter({ config }) {
  const router = Router();
  const controller = createStatsController(config);
  router.get('/', requireRole('placement_officer', 'tpo_head'), validateQuery(statsQuerySchema), controller.getStats);
  return router;
}

module.exports = { createStatsRouter };
