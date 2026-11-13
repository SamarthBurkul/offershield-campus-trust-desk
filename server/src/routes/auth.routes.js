'use strict';

const { Router } = require('express');
const { createAuthController } = require('../controllers/auth.controller');
const { createLoginRateLimiters, createRegisterRateLimiter } = require('../middleware/authRateLimiter');
const { enforcePasswordChange } = require('../middleware/enforcePasswordChange');
const { validateBody } = require('../middleware/validate');
const { createRateLimiter } = require('../middleware/rateLimiter');
const {
  registerSchema,
  loginSchema,
  changePasswordSchema,
  verifyEmailSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
} = require('../validators/auth.schemas');

const HOUR_MS = 60 * 60 * 1000;
const LIMIT_MESSAGE = 'Too many attempts, please try again later';

function createAuthRouter({ config, authenticate }) {
  const router = Router();
  const controller = createAuthController(config);
  const loginLimiters = createLoginRateLimiters(config.authRateLimit);
  const registerLimiter = createRegisterRateLimiter(config.registerRateLimit);
  const forgotLimiters = [
    createRateLimiter({ windowMs: HOUR_MS, max: 20, message: LIMIT_MESSAGE }),
    createRateLimiter({
      windowMs: HOUR_MS,
      max: 3,
      message: LIMIT_MESSAGE,
      keyGenerator: (req) => `forgot:${String(req.body?.email ?? '').trim().toLowerCase().slice(0, 254)}`,
    }),
  ];
  const resetLimiter = createRateLimiter({ windowMs: HOUR_MS, max: 20, message: LIMIT_MESSAGE });
  const verifyLimiter = createRateLimiter({ windowMs: HOUR_MS, max: 30, message: LIMIT_MESSAGE });

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
  router.post('/verify-email', verifyLimiter, authenticate, enforcePasswordChange, validateBody(verifyEmailSchema), controller.verifyEmail);
  router.post('/resend-verification', authenticate, enforcePasswordChange, controller.resendVerification);
  router.post('/forgot-password', ...forgotLimiters, validateBody(forgotPasswordSchema), controller.forgotPassword);
  router.post('/reset-password', resetLimiter, validateBody(resetPasswordSchema), controller.resetPassword);

  return router;
}

module.exports = { createAuthRouter };
