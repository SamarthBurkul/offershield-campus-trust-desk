'use strict';

const { randomInt } = require('node:crypto');

// No 0/O, 1/I/L: codes are read aloud and typed by hand.
const UNAMBIGUOUS_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const PASSWORD_LETTERS = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz';
const PASSWORD_DIGITS = '23456789';

function randomString(alphabet, length) {
  let out = '';
  for (let i = 0; i < length; i += 1) out += alphabet[randomInt(alphabet.length)];
  return out;
}

function generateJoinCode(length = 10) {
  return randomString(UNAMBIGUOUS_ALPHABET, length);
}

/** Join codes are compared case-insensitively and ignoring surrounding spaces and dashes. */
function normalizeJoinCode(code) {
  return String(code).trim().toUpperCase().replace(/[\s-]/g, '');
}

/** 16 characters, always containing letters and digits, so it satisfies the password policy. */
function generateTemporaryPassword(length = 16) {
  for (;;) {
    const candidate = randomString(PASSWORD_LETTERS + PASSWORD_DIGITS, length);
    if (/[A-Za-z]/.test(candidate) && /\d/.test(candidate)) return candidate;
  }
}

module.exports = { generateJoinCode, normalizeJoinCode, generateTemporaryPassword };
