'use strict';

const AppError = require('../utils/AppError');

function parseOrThrow(schema, input) {
  const result = schema.safeParse(input);
  if (!result.success) {
    // Messages name fields and rules only, never submitted values.
    const details = result.error.issues
      .slice(0, 5)
      .map((issue) => (issue.path.length ? `${issue.path.join('.')}: ${issue.message}` : issue.message));
    throw new AppError(400, 'VALIDATION_ERROR', `Invalid request: ${details.join('; ')}`);
  }
  return result.data;
}

/**
 * Validate req.body against a zod schema and replace it with the parsed value.
 * @param {import('zod').ZodType} schema
 */
function validateBody(schema) {
  return function validate(req, _res, next) {
    req.body = parseOrThrow(schema, req.body ?? {});
    next();
  };
}

/**
 * Validate the query string. Express 5's req.query is read-only, so the parsed value goes to req.validatedQuery.
 * @param {import('zod').ZodType} schema
 */
function validateQuery(schema) {
  return function validate(req, _res, next) {
    req.validatedQuery = parseOrThrow(schema, { ...req.query });
    next();
  };
}

module.exports = { validateBody, validateQuery };
