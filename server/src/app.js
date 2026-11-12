'use strict';

const path = require('node:path');
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const compression = require('compression');
const cookieParser = require('cookie-parser');

const { config: defaultConfig } = require('./config/env');
const { createApiRouter } = require('./routes');
const notFound = require('./middleware/notFound');
const { createErrorHandler } = require('./middleware/errorHandler');
const { createApiRateLimiter } = require('./middleware/rateLimiter');
const { requestId } = require('./middleware/requestId');
const { createRequestLogger } = require('./middleware/requestLogger');
const { createClientRouter } = require('./middleware/serveClient');

const DEFAULT_CLIENT_DIST = path.resolve(__dirname, '../../client/dist');
const HSTS_MAX_AGE_SECONDS = 180 * 24 * 60 * 60;

// The built client loads only its own scripts and styles; React inline styles need 'unsafe-inline'.
const CSP_DIRECTIVES = Object.freeze({
  defaultSrc: ["'self'"],
  scriptSrc: ["'self'"],
  styleSrc: ["'self'", "'unsafe-inline'"],
  imgSrc: ["'self'", 'data:', 'blob:'],
  fontSrc: ["'self'", 'data:'],
  connectSrc: ["'self'"],
  frameAncestors: ["'none'"],
  objectSrc: ["'none'"],
  baseUri: ["'self'"],
  formAction: ["'self'"],
});

/**
 * Build the Express app without listening, so tests can drive it with Supertest.
 * In production it also serves the built client (one service, same origin as the API).
 * @param {ReturnType<import('./config/env').loadConfig>} config
 * @param {{ clientDistDir?: string, serveClient?: boolean, logSink?: (line: string) => void }} [options]
 */
function createApp(config = defaultConfig, options = {}) {
  const app = express();
  const { clientDistDir = DEFAULT_CLIENT_DIST, serveClient = config.isProduction } = options;
  // Request lines go to stdout outside tests; tests opt in with their own sink.
  const logSink = options.logSink ?? (config.nodeEnv === 'test' ? null : undefined);

  app.disable('x-powered-by');
  // 0 locally; 1 behind Render's proxy so req.ip (and the per-IP limits) use the real client address.
  app.set('trust proxy', config.trustProxy);
  app.use(requestId);
  if (logSink !== null) app.use(createRequestLogger({ sink: logSink }));
  app.use(
    helmet({
      contentSecurityPolicy: { useDefaults: false, directives: CSP_DIRECTIVES },
      hsts: config.isProduction ? { maxAge: HSTS_MAX_AGE_SECONDS, includeSubDomains: true } : false,
    }),
  );
  app.use(compression());
  app.use(
    cors({
      // Requests without an Origin header (curl, server-to-server) are allowed.
      // A disallowed origin gets no CORS headers rather than an error.
      origin: (origin, callback) => callback(null, !origin || config.clientOrigins.includes(origin)),
      credentials: true,
    }),
  );
  app.use(express.json({ limit: '100kb' }));
  app.use(cookieParser());
  app.use('/api', createApiRateLimiter(config.rateLimit, config));
  app.use('/api/v1', createApiRouter(config));
  if (serveClient) app.use(createClientRouter(clientDistDir));
  app.use(notFound);
  app.use(createErrorHandler(config));

  return app;
}

const app = createApp();

module.exports = { app, createApp };
