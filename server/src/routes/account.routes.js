'use strict';

const { Router } = require('express');
const controller = require('../controllers/account.controller');
const { enforcePasswordChange } = require('../middleware/enforcePasswordChange');
const { validateBody } = require('../middleware/validate');
const { updateAccountSchema } = require('../validators/account.schemas');

/** /api/v1/account: the signed-in user's own profile and email preferences (every role). */
function createAccountRouter({ authenticate }) {
  const router = Router();
  router.use(authenticate, enforcePasswordChange);
  router.get('/', controller.getAccount);
  router.patch('/', validateBody(updateAccountSchema), controller.updateAccount);
  return router;
}

module.exports = { createAccountRouter };
