'use strict';

// Verhoeff checksum (dihedral group D5), used by Aadhaar numbers.
const D = [
  [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
  [1, 2, 3, 4, 0, 6, 7, 8, 9, 5],
  [2, 3, 4, 0, 1, 7, 8, 9, 5, 6],
  [3, 4, 0, 1, 2, 8, 9, 5, 6, 7],
  [4, 0, 1, 2, 3, 9, 5, 6, 7, 8],
  [5, 9, 8, 7, 6, 0, 4, 3, 2, 1],
  [6, 5, 9, 8, 7, 1, 0, 4, 3, 2],
  [7, 6, 5, 9, 8, 2, 1, 0, 4, 3],
  [8, 7, 6, 5, 9, 3, 2, 1, 0, 4],
  [9, 8, 7, 6, 5, 4, 3, 2, 1, 0],
];
const P = [
  [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
  [1, 5, 7, 6, 2, 8, 3, 0, 9, 4],
  [5, 8, 0, 3, 7, 9, 6, 1, 4, 2],
  [8, 9, 1, 6, 0, 4, 3, 5, 2, 7],
  [9, 4, 5, 3, 1, 2, 8, 6, 7, 0],
  [4, 2, 8, 6, 5, 7, 3, 9, 0, 1],
  [2, 7, 9, 3, 8, 0, 6, 4, 1, 5],
  [7, 0, 4, 6, 9, 1, 3, 2, 5, 8],
];
const INV = [0, 4, 3, 2, 1, 5, 6, 7, 8, 9];

function checksumState(digits, offset) {
  let c = 0;
  const reversed = digits.split('').reverse();
  reversed.forEach((digit, i) => {
    c = D[c][P[(i + offset) % 8][Number(digit)]];
  });
  return c;
}

/** True when the digit string (check digit last) passes the Verhoeff check. */
function isValidVerhoeff(digits) {
  if (!/^\d+$/.test(String(digits))) return false;
  return checksumState(String(digits), 0) === 0;
}

/** The Verhoeff check digit to append to a digit string. */
function verhoeffCheckDigit(digits) {
  if (!/^\d+$/.test(String(digits))) throw new TypeError('digits must be a string of 0-9');
  return INV[checksumState(String(digits), 1)];
}

module.exports = { isValidVerhoeff, verhoeffCheckDigit };
