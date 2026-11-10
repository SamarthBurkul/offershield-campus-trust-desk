'use strict';

const { Router } = require('express');
const controller = require('../controllers/admin.controller');
const { enforcePasswordChange } = require('../middleware/enforcePasswordChange');
const { requireRole } = require('../middleware/requireRole');
const { validateBody } = require('../middleware/validate');
const {
  createCollegeSchema,
  updateCollegeSchema,
  createStaffSchema,
  emptyBodySchema,
} = require('../validators/admin.schemas');

function createAdminRouter({ authenticate }) {
  const router = Router();

  router.use(authenticate, enforcePasswordChange, requireRole('super_admin'));

  router.post('/colleges', validateBody(createCollegeSchema), controller.createCollege);
  router.get('/colleges', controller.listColleges);
  router.get('/colleges/:id', controller.getCollege);
  router.patch('/colleges/:id', validateBody(updateCollegeSchema), controller.updateCollege);
  router.post('/colleges/:id/rotate-join-code', validateBody(emptyBodySchema), controller.rotateJoinCode);
  router.post('/colleges/:id/tpo-heads', validateBody(createStaffSchema), controller.createTpoHead);
  router.get('/colleges/:id/staff', controller.listCollegeStaff);

  return router;
}

module.exports = { createAdminRouter };
