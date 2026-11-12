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
const { createStudentRouter } = require('./student.routes');
const studentController = require('../controllers/student.controller');
const { emptyBodySchema } = require('../validators/admin.schemas');

function createStaffRouter({ config, authenticate }) {
  const router = Router();

  router.use(authenticate, enforcePasswordChange, requireTenant);

  router.use('/cases', createStaffCaseRouter({ config }));
  router.use('/audit', createAuditRouter());
  router.use('/registry', createRegistryRouter({ config }));
  router.use('/advisories', createStaffAdvisoryRouter());
  router.use('/stats', createStatsRouter({ config }));
  router.use('/students', createStudentRouter());

  router.get('/members', requireRole('tpo_head', 'placement_officer'), controller.listMembers);
  router.post('/officers', requireRole('tpo_head'), validateBody(createOfficerSchema), controller.createOfficer);
  router.patch(
    '/officers/:id/status',
    requireRole('tpo_head'),
    validateBody(officerStatusSchema),
    controller.setOfficerStatus,
  );
  // Heads reset officers and students; officers reset students (checked in staff.service).
  router.post(
    '/users/:id/reset-password',
    requireRole('tpo_head', 'placement_officer'),
    validateBody(emptyBodySchema),
    studentController.resetPassword,
  );

  return router;
}

module.exports = { createStaffRouter };
