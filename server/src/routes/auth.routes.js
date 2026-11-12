'use strict';

const { Router } = require('express');
const { createAuthController } = require('../controllers/auth.controller');
const { createLoginRateLimiters, createRegisterRateLimiter } = require('../middleware/authRateLimiter');
const { enforcePasswordChange } = require('../middleware/enforcePasswordChange');
const { validateBody } = require('../middleware/validate');
const { registerSchema, loginSchema, changePasswordSchema } = require('../validators/auth.schemas');

function createAuthRouter({ config, authenticate }) {
  const router = Router();
  const controller = createAuthController(config);
  const loginLimiters = createLoginRateLimiters(config.authRateLimit);
  const registerLimiter = createRegisterRateLimiter(config.registerRateLimit);

  router.post('/register', registerLimiter, validateBody(registerSchema), controller.register);
  router.post('/login', ...loginLimiters, validateBody(loginSchema), controller.login);
  // Logout works with or without a valid session, so a stale cookie can always be cleared.
  router.post('/logout', controller.logout);
  router.get('/me', authenticate, enforcePasswordChange, controller.me);
  router.post(
    '/change-password',
    authenticate,
    enforcePasswordChange,
    validateBody(changePasswordSchema),
    controller.changePassword,
  );

  return router;
}

module.exports = { createAuthRouter };
