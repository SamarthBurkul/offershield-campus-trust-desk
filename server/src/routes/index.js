'use strict';

const { Router } = require('express');
const healthRoutes = require('./health.routes');
const { createAuthRouter } = require('./auth.routes');
const { createAdminRouter } = require('./admin.routes');
const { createCollegeRouter } = require('./college.routes');
const { createStaffRouter } = require('./staff.routes');
const { createAuthenticate } = require('../middleware/authenticate');

/**
 * The /api/v1 router (mounted by app.js). Built per app so each app instance
 * gets its own config and rate-limit counters.
 */
function createApiRouter(config) {
  const router = Router();
  const deps = { config, authenticate: createAuthenticate(config) };

  router.use('/health', healthRoutes);
  router.use('/auth', createAuthRouter(deps));
  router.use('/admin', createAdminRouter(deps));
  router.use('/college', createCollegeRouter(deps));
  router.use('/staff', createStaffRouter(deps));

  return router;
}

module.exports = { createApiRouter };
