'use strict';

const { Router } = require('express');
const { createGoogleAuthController } = require('../controllers/googleAuth.controller');
const { createRateLimiter } = require('../middleware/rateLimiter');
const { createRegisterRateLimiter } = require('../middleware/authRateLimiter');
const { validateBody, validateQuery } = require('../middleware/validate');
const { googleStartQuerySchema, googleCompleteSchema } = require('../validators/googleAuth.schemas');

/** /api/v1/auth/google (all routes 404 unless GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET and a redirect URI are set). */
function createGoogleAuthRouter({ config }) {
  const router = Router();
  const controller = createGoogleAuthController(config);
  const flowLimiter = createRateLimiter({ windowMs: config.authRateLimit.windowMs, max: config.authRateLimit.ipMax });

  router.use(controller.requireEnabled);
  router.get('/start', flowLimiter, validateQuery(googleStartQuerySchema), controller.start);
  router.get('/callback', flowLimiter, controller.callback);
  router.get('/pending', controller.pending);
  router.post('/complete', createRegisterRateLimiter(config.registerRateLimit), validateBody(googleCompleteSchema), controller.complete);

  return router;
}

module.exports = { createGoogleAuthRouter };
