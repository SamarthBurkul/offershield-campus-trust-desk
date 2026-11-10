'use strict';

const AppError = require('../utils/AppError');

/**
 * Validate req.body against a zod schema and replace it with the parsed value.
 * Messages name fields and rules only, never submitted values.
 * @param {import('zod').ZodType} schema
 */
function validateBody(schema) {
  return function validate(req, _res, next) {
    const result = schema.safeParse(req.body ?? {});
    if (!result.success) {
      const details = result.error.issues
        .slice(0, 5)
        .map((issue) => (issue.path.length ? `${issue.path.join('.')}: ${issue.message}` : issue.message));
      throw new AppError(400, 'VALIDATION_ERROR', `Invalid request: ${details.join('; ')}`);
    }
    req.body = result.data;
    next();
  };
}

module.exports = { validateBody };
