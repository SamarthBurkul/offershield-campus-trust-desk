'use strict';

const { Router } = require('express');
const controller = require('../controllers/college.controller');
const { enforcePasswordChange } = require('../middleware/enforcePasswordChange');
const { requireTenant } = require('../middleware/requireTenant');

function createCollegeRouter({ authenticate }) {
  const router = Router();

  router.use(authenticate, enforcePasswordChange, requireTenant);
  router.get('/me', controller.getMyCollege);

  return router;
}

module.exports = { createCollegeRouter };
