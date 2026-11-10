'use strict';

/**
 * Operational error with an HTTP status and a stable UPPER_SNAKE error code.
 * The error handler turns it into the standard error envelope.
 */
class AppError extends Error {
  /**
   * @param {number} statusCode HTTP status, e.g. 404
   * @param {string} code UPPER_SNAKE error code, e.g. "NOT_FOUND"
   * @param {string} message Safe, user-facing message
   */
  constructor(statusCode, code, message) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.code = code;
  }
}

module.exports = AppError;
