'use strict';

const { Router } = require('express');
const controller = require('../controllers/lookup.controller');
const { enforcePasswordChange } = require('../middleware/enforcePasswordChange');
const { createLookupRateLimiter } = require('../middleware/lookupRateLimiter');
const { requireRole } = require('../middleware/requireRole');
const { requireTenant } = require('../middleware/requireTenant');
const { validateQuery } = require('../middleware/validate');
const { lookupQuerySchema } = require('../validators/lookup.schemas');

function createLookupRouter({ config, authenticate }) {
  const router = Router();

  router.get(
    '/',
    authenticate,
    enforcePasswordChange,
    requireTenant,
    requireRole('student', 'placement_officer', 'tpo_head'),
    createLookupRateLimiter({ maxPer10Min: config.lookupLimitPer10Min }),
    validateQuery(lookupQuerySchema),
    controller.lookup,
  );

  return router;
}

module.exports = { createLookupRouter };
