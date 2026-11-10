'use strict';

const { Router } = require('express');
const { createFileController } = require('../controllers/file.controller');
const { enforcePasswordChange } = require('../middleware/enforcePasswordChange');

function createFileRouter({ config, authenticate }) {
  const router = Router();
  const controller = createFileController(config);

  // Both the short-lived link token and a valid session for the same user are required.
  router.get('/:token', authenticate, enforcePasswordChange, controller.download);

  return router;
}

module.exports = { createFileRouter };
