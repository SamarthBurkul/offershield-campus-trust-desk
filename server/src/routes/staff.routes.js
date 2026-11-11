'use strict';

const { Router } = require('express');
const controller = require('../controllers/staff.controller');
const { enforcePasswordChange } = require('../middleware/enforcePasswordChange');
const { requireRole } = require('../middleware/requireRole');
const { requireTenant } = require('../middleware/requireTenant');
const { validateBody } = require('../middleware/validate');
const { createOfficerSchema, officerStatusSchema } = require('../validators/staff.schemas');
const { createStaffCaseRouter } = require('./staffCase.routes');
const { createAuditRouter } = require('./audit.routes');
const { createRegistryRouter } = require('./registry.routes');
const { createStaffAdvisoryRouter } = require('./advisory.routes');
const { createStatsRouter } = require('./stats.routes');

function createStaffRouter({ config, authenticate }) {
  const router = Router();

  router.use(authenticate, enforcePasswordChange, requireTenant);

  router.use('/cases', createStaffCaseRouter({ config }));
  router.use('/audit', createAuditRouter());
  router.use('/registry', createRegistryRouter({ config }));
  router.use('/advisories', createStaffAdvisoryRouter());
  router.use('/stats', createStatsRouter({ config }));

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
