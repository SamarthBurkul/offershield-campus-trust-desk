'use strict';

const { Router } = require('express');
const controller = require('../controllers/advisory.controller');
const { enforcePasswordChange } = require('../middleware/enforcePasswordChange');
const { requireRole } = require('../middleware/requireRole');
const { requireTenant } = require('../middleware/requireTenant');
const { validateBody, validateQuery } = require('../middleware/validate');
const schemas = require('../validators/advisory.schemas');
const { emptyBodySchema } = require('../validators/admin.schemas');

/** Mounted at /staff/advisories inside the staff router (authenticate → enforcePasswordChange → requireTenant). */
function createStaffAdvisoryRouter() {
  const router = Router();
  const headOnly = requireRole('tpo_head');

  router.use(requireRole('placement_officer', 'tpo_head'));
  router.get('/', validateQuery(schemas.staffListQuerySchema), controller.listForStaff);
  router.get('/audience-count', validateQuery(schemas.audienceQuerySchema), controller.audienceCount);
  router.post('/', validateBody(schemas.createAdvisorySchema), controller.create);
  router.get('/:id', controller.getForStaff);
  router.patch('/:id', validateBody(schemas.updateAdvisorySchema), controller.update);
  router.post('/:id/publish', headOnly, validateBody(emptyBodySchema), controller.publish);
  router.post('/:id/withdraw', headOnly, validateBody(schemas.withdrawSchema), controller.withdraw);
  return router;
}

/** Mounted at /advisories: students only. */
function createStudentAdvisoryRouter({ authenticate }) {
  const router = Router();
  router.use(authenticate, enforcePasswordChange, requireTenant, requireRole('student'));
  router.get('/', controller.listForStudent);
  router.get('/:id', controller.getForStudent);
  router.post('/:id/ack', validateBody(emptyBodySchema), controller.acknowledge);
  return router;
}

module.exports = { createStaffAdvisoryRouter, createStudentAdvisoryRouter };
