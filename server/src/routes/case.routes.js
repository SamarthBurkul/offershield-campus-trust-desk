'use strict';

const { Router } = require('express');
const caseController = require('../controllers/case.controller');
const { createEvidenceController } = require('../controllers/evidence.controller');
const { createCaseRateLimiter } = require('../middleware/caseRateLimiter');
const { enforcePasswordChange } = require('../middleware/enforcePasswordChange');
const { requireRole } = require('../middleware/requireRole');
const { requireTenant } = require('../middleware/requireTenant');
const { uploadEvidenceFiles } = require('../middleware/upload');
const { validateBody, validateQuery } = require('../middleware/validate');
const { createCaseSchema, caseMessageSchema, listMyCasesQuerySchema } = require('../validators/case.schemas');
const { emptyBodySchema } = require('../validators/admin.schemas');

function createCaseRouter({ config, authenticate }) {
  const router = Router();
  const evidence = createEvidenceController(config);
  const student = [requireRole('student'), requireTenant];

  router.use(authenticate, enforcePasswordChange);

  router.post(
    '/',
    ...student,
    createCaseRateLimiter({ maxPerHour: config.caseCreateLimitPerHour }),
    validateBody(createCaseSchema),
    caseController.createCase,
  );
  router.get('/mine', ...student, validateQuery(listMyCasesQuerySchema), caseController.listMyCases);
  router.get('/:id', ...student, caseController.getCase);
  router.post('/:id/messages', ...student, validateBody(caseMessageSchema), caseController.addMessage);
  router.post('/:id/evidence', ...student, evidence.checkUploadAllowed, uploadEvidenceFiles, evidence.upload);
  // Staff of the same college may also open evidence (read-only). Super admin is refused by requireTenant.
  router.post(
    '/:id/evidence/:evidenceId/link',
    requireTenant,
    requireRole('student', 'placement_officer', 'tpo_head'),
    validateBody(emptyBodySchema),
    evidence.createLink,
  );

  return router;
}

module.exports = { createCaseRouter };
