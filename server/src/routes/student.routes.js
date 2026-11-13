'use strict';

const { Router } = require('express');
const controller = require('../controllers/student.controller');
const { requireRole } = require('../middleware/requireRole');
const { validateBody, validateQuery } = require('../middleware/validate');
const { emptyBodySchema } = require('../validators/admin.schemas');
const schemas = require('../validators/student.schemas');

/** Mounted at /staff/students inside the staff router (authenticate → enforcePasswordChange → requireTenant). */
function createStudentRouter() {
  const router = Router();
  router.use(requireRole('placement_officer', 'tpo_head'));

  router.get('/', validateQuery(schemas.studentListQuerySchema), controller.listStudents);
  router.post('/promote-year', requireRole('tpo_head'), validateBody(schemas.promoteYearSchema), controller.promoteYear);
  router.post('/bulk-approve', validateBody(schemas.bulkApproveSchema), controller.bulkApprove);
  router.post('/:id/approve', validateBody(emptyBodySchema), controller.approve);
  router.post('/:id/reject', validateBody(schemas.rejectStudentSchema), controller.reject);
  router.patch('/:id/status', validateBody(schemas.studentStatusSchema), controller.setStatus);

  return router;
}

module.exports = { createStudentRouter };
