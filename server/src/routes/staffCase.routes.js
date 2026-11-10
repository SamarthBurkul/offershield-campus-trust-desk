'use strict';

const { Router } = require('express');
const { createStaffCaseController } = require('../controllers/staffCase.controller');
const { requireRole } = require('../middleware/requireRole');
const { validateBody, validateQuery } = require('../middleware/validate');
const schemas = require('../validators/staffCase.schemas');

/**
 * Mounted at /staff/cases inside the staff router, which already applies
 * authenticate → enforcePasswordChange → requireTenant.
 */
function createStaffCaseRouter({ config }) {
  const router = Router();
  const controller = createStaffCaseController(config);
  const headOnly = requireRole('tpo_head');

  router.use(requireRole('placement_officer', 'tpo_head'));

  router.get('/', validateQuery(schemas.queueQuerySchema), controller.listQueue);
  router.get('/counts', controller.getCounts);
  router.get('/:id', controller.getCase);
  router.patch('/:id/assign', validateBody(schemas.assignSchema), controller.assign);
  router.patch('/:id/status', validateBody(schemas.statusSchema), controller.changeStatus);
  router.post('/:id/info-request', validateBody(schemas.infoRequestSchema), controller.requestInfo);
  router.post('/:id/messages', validateBody(schemas.staffMessageSchema), controller.sendMessage);
  router.post('/:id/notes', validateBody(schemas.noteSchema), controller.addNote);
  router.post('/:id/recommendation', validateBody(schemas.recommendationSchema), controller.recommend);
  // Final decisions and reopening are TPO-head only (ADR-024).
  router.post('/:id/decision', headOnly, validateBody(schemas.decisionSchema), controller.decide);
  router.post('/:id/reopen', headOnly, validateBody(schemas.reopenSchema), controller.reopen);

  return router;
}

module.exports = { createStaffCaseRouter };
