'use strict';

const AppError = require('../utils/AppError');

/**
 * Map an error to { status, code, message }. Only safe, fixed messages are
 * returned for parser errors because their native messages can echo body content.
 */
function classify(err) {
  if (err instanceof AppError) {
    return { status: err.statusCode, code: err.code, message: err.message };
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
  return { status: 500, code: 'INTERNAL_ERROR', message: 'An unexpected error occurred' };
}

/**
 * Build the final error-handling middleware.
 * @param {{ nodeEnv: string }} options
 */
function createErrorHandler({ nodeEnv }) {
  // Express identifies error handlers by their four-argument signature.
  return function errorHandler(err, req, res, _next) {
    const { status, code, message } = classify(err);

    // Log method, path and outcome only - never request bodies or headers.
    if (status >= 500) {
      console.error(`[error] ${req.method} ${req.originalUrl} -> ${status} ${code}\n${err && err.stack}`);
    } else {
      console.warn(`[warn] ${req.method} ${req.originalUrl} -> ${status} ${code}`);
    }

    const body = { error: { code, message } };
    // Stack traces are only ever exposed for unexpected errors in local development.
    if (status >= 500 && nodeEnv === 'development' && err && err.stack) {
      body.error.stack = err.stack;
    }

    res.status(status).json(body);
  };
}

module.exports = { createErrorHandler };
