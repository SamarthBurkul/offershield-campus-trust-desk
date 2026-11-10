'use strict';

const express = require('express');
const helmet = require('helmet');
const cors = require('cors');

const { config: defaultConfig } = require('./config/env');
const apiRoutes = require('./routes');
const notFound = require('./middleware/notFound');
const { createErrorHandler } = require('./middleware/errorHandler');
const { createApiRateLimiter } = require('./middleware/rateLimiter');

/**
 * Build the Express app without listening, so tests can drive it with Supertest.
 * @param {ReturnType<import('./config/env').loadConfig>} config
 */
function createApp(config = defaultConfig) {
  const app = express();

  app.disable('x-powered-by');
  app.use(helmet());
  app.use(
    cors({
      // Requests without an Origin header (curl, server-to-server) are allowed.
      // A disallowed origin gets no CORS headers rather than an error.
      origin: (origin, callback) => callback(null, !origin || config.clientOrigins.includes(origin)),
      credentials: true,
    }),
  );
  app.use(express.json({ limit: '100kb' }));
  app.use('/api', createApiRateLimiter(config.rateLimit));
  app.use('/api/v1', apiRoutes);
  app.use(notFound);
  app.use(createErrorHandler(config));

  return app;
}

const app = createApp();

module.exports = { app, createApp };
