'use strict';

const AppError = require('../utils/AppError');

/**
 * Map an error to { status, code, message }. Only safe, fixed messages are
 * returned for parser errors because their native messages can echo body content.
 */
function classify(err) {
  if (err instanceof AppError) {
    return { status: err.statusCode, code: err.code, message: err.message, details: err.details };
  }
  if (err && err.type === 'entity.parse.failed') {
    return { status: 400, code: 'INVALID_JSON', message: 'Malformed JSON body' };
  }
  if (err && err.type === 'entity.too.large') {
    return { status: 413, code: 'PAYLOAD_TOO_LARGE', message: 'Request body is too large' };
  }
  if (err && err.type && Number.isInteger(err.status) && err.status >= 400 && err.status < 500) {
    // Other body-parser client errors (unsupported charset/encoding, etc.).
    return { status: err.status, code: 'BAD_REQUEST', message: 'Invalid request body' };
  }
  if (err && err.name === 'ValidationError' && err.errors) {
    // Mongoose validation: field names only, values could be echoed in the native message.
    return { status: 400, code: 'VALIDATION_ERROR', message: `Invalid data: ${Object.keys(err.errors).join(', ')}` };
  }
  if (err && err.code === 11000) {
    return { status: 409, code: 'CONFLICT', message: 'A record with these details already exists' };
  }
  return { status: 500, code: 'INTERNAL_ERROR', message: 'An unexpected error occurred' };
}

/**
 * Build the final error-handling middleware.
 * @param {{ nodeEnv: string }} options
 */
function createErrorHandler({ nodeEnv }) {
  // Express identifies error handlers by their four-argument signature.
  return function errorHandler(err, req, res, _next) {
    const { status, code, message, details } = classify(err);

    // The request id and error code only: the request line (path, status) is logged by requestLogger,
    // and URLs, bodies and headers can carry personal data. Stacks are printed only in development.
    const line = JSON.stringify({ t: new Date().toISOString(), requestId: req.id ?? null, code });
    if (status >= 500) {
      console.error(nodeEnv === 'development' && err?.stack ? `${line}\n${err.stack}` : line);
    } else {
      console.warn(line);
    }

    const body = { error: { code, message } };
    // Optional safe, structured context set by a service (e.g. the conflicting recruiter's id).
    if (details) body.error.details = details;
    // Stack traces are only ever exposed for unexpected errors in local development.
    if (status >= 500 && nodeEnv === 'development' && err && err.stack) {
      body.error.stack = err.stack;
    }

    res.status(status).json(body);
  };
}

module.exports = { createErrorHandler };
