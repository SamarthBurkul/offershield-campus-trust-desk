'use strict';

const AppError = require('./AppError');
const { isValidVerhoeff } = require('./verhoeff');

// PAN: 5 letters, 4 digits, 1 letter.
const PAN_PATTERN = /(?<![A-Za-z0-9])[A-Za-z]{5}[0-9]{4}[A-Za-z](?![A-Za-z0-9])/;
// Aadhaar: 12 digits, first 2-9, optionally grouped 4-4-4 with one consistent separator.
// Not preceded by "+" or a digit, so "+91..." phone numbers and longer numbers do not match.
const AADHAAR_PATTERN = /(?<![\d+])[2-9]\d{3}([ -]?)\d{4}\1\d{4}(?!\d)/g;

function containsAadhaar(text) {
  for (const match of text.matchAll(AADHAAR_PATTERN)) {
    if (isValidVerhoeff(match[0].replace(/[ -]/g, ''))) return true;
  }
  return false;
}

/** True if the text appears to contain a PAN or a checksum-valid Aadhaar number. */
function containsSensitiveId(text) {
  if (typeof text !== 'string' || text.length === 0) return false;
  return PAN_PATTERN.test(text) || containsAadhaar(text);
}

/**
 * Throw 400 SENSITIVE_ID_DETECTED if any value contains a PAN or Aadhaar number.
 * The matched value is never echoed in the response or logs.
 * @param {Array<string | string[] | null | undefined>} values
 */
function assertNoSensitiveIds(values) {
  const texts = values.flat(Infinity).filter((value) => typeof value === 'string');
  if (texts.some(containsSensitiveId)) {
    throw new AppError(
      400,
      'SENSITIVE_ID_DETECTED',
      'Your request appears to contain an Aadhaar or PAN number. Please remove it or mask it (for example XXXX XXXX 1234) and try again.',
    );
  }
}

module.exports = { containsSensitiveId, assertNoSensitiveIds };
