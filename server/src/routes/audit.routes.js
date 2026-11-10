'use strict';

const { Router } = require('express');
const controller = require('../controllers/audit.controller');
const { requireRole } = require('../middleware/requireRole');
const { validateQuery } = require('../middleware/validate');
const { auditQuerySchema } = require('../validators/staffCase.schemas');

/** Mounted at /staff/audit inside the staff router (authenticate → enforcePasswordChange → requireTenant). */
function createAuditRouter() {
  const router = Router();
  router.get('/', requireRole('tpo_head'), validateQuery(auditQuerySchema), controller.listAudit);
  return router;
}

module.exports = { createAuditRouter };
