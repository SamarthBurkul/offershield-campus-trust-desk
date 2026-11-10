'use strict';

const { Router } = require('express');
const controller = require('../controllers/staff.controller');
const { enforcePasswordChange } = require('../middleware/enforcePasswordChange');
const { requireRole } = require('../middleware/requireRole');
const { requireTenant } = require('../middleware/requireTenant');
const { validateBody } = require('../middleware/validate');
const { createOfficerSchema, officerStatusSchema } = require('../validators/staff.schemas');

function createStaffRouter({ authenticate }) {
  const router = Router();

  router.use(authenticate, enforcePasswordChange, requireTenant);

  router.get('/members', requireRole('tpo_head', 'placement_officer'), controller.listMembers);
  router.post('/officers', requireRole('tpo_head'), validateBody(createOfficerSchema), controller.createOfficer);
  router.patch(
    '/officers/:id/status',
    requireRole('tpo_head'),
    validateBody(officerStatusSchema),
    controller.setOfficerStatus,
  );

  return router;
}

module.exports = { createStaffRouter };
