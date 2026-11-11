'use strict';

const { Router } = require('express');
const { createRegistryController } = require('../controllers/registry.controller');
const { requireRole } = require('../middleware/requireRole');
const { validateBody, validateQuery } = require('../middleware/validate');
const schemas = require('../validators/registry.schemas');
const { emptyBodySchema } = require('../validators/admin.schemas');

/**
 * Mounted at /staff/registry inside the staff router (authenticate → enforcePasswordChange → requireTenant).
 * Deliberately no route creates a fraud indicator: they come only from TPO-head decisions.
 */
function createRegistryRouter({ config }) {
  const router = Router();
  const controller = createRegistryController(config);
  const headOnly = requireRole('tpo_head');

  router.use(requireRole('placement_officer', 'tpo_head'));

  router.get('/recruiters', validateQuery(schemas.recruiterListQuerySchema), controller.listRecruiters);
  router.post('/recruiters', validateBody(schemas.createRecruiterSchema), controller.createRecruiter);
  router.patch('/recruiters/:id', validateBody(schemas.updateRecruiterSchema), controller.updateRecruiter);
  router.post('/recruiters/:id/approve', headOnly, validateBody(emptyBodySchema), controller.approveRecruiter);
  router.post('/recruiters/:id/renew', headOnly, validateBody(schemas.renewRecruiterSchema), controller.renewRecruiter);
  router.post('/recruiters/:id/suspend', headOnly, validateBody(schemas.suspendRecruiterSchema), controller.suspendRecruiter);

  router.get('/indicators', validateQuery(schemas.indicatorListQuerySchema), controller.listIndicators);
  router.post('/indicators/:id/revoke', headOnly, validateBody(schemas.revokeIndicatorSchema), controller.revokeIndicator);

  return router;
}

module.exports = { createRegistryRouter };
