'use strict';

/**
 * 64-bit SimHash for near-duplicate message detection (pure). Contact details and numbers are
 * replaced by placeholders first, so template scams with different names, amounts or UPI IDs
 * still hash close together. Parameters are documented in DECISIONS.md (ADR-031).
 */
const FNV_OFFSET = 0xcbf29ce484222325n;
const FNV_PRIME = 0x100000001b3n;
const MASK_64 = (1n << 64n) - 1n;
const SHINGLE_SIZE = 3;
// Messages with fewer words than this are too short to compare as "similar text".
const MIN_WORDS_FOR_SIMILARITY = 8;

const encoder = new TextEncoder();

function fnv1a64(text) {
  let hash = FNV_OFFSET;
  for (const byte of encoder.encode(text)) {
    hash ^= BigInt(byte);
    hash = (hash * FNV_PRIME) & MASK_64;
  }
  return hash;
}

/**
 * Lowercase; placeholders for URLs, emails, UPI IDs and phones; any run of digits -> one "#"
 * (so 999 and 1499 look the same); the name after a salutation ("Dear Rahul") -> a placeholder;
 * words only, whitespace collapsed.
 */
function normalizeForHash(text) {
  return String(text ?? '')
    .toLowerCase()
    .replace(/\bhttps?:\/\/\S+/g, ' urltoken ')
    .replace(/[\p{L}\p{N}._%+-]+@[\p{L}\p{N}-]+(?:\.[\p{L}\p{N}-]+)+/gu, ' emailtoken ')
    .replace(/[\p{L}\p{N}._-]{2,}@\p{L}[\p{L}\p{N}]{1,63}\b/gu, ' upitoken ')
    .replace(/(?:\+?91[\s-]?|0)?[6-9]\d{4}[\s-]?\d{5}\b/g, ' phonetoken ')
    .replace(/\d+(?:[.,]\d+)*/g, '#')
    .replace(/\b(dear|hi|hello|hey|congratulations)[\s,]+(mr\.?\s+|ms\.?\s+|mrs\.?\s+)?\p{L}+/gu, '$1 nametoken')
    .replace(/[^\p{L}#]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function words(text) {
  const normalized = normalizeForHash(text);
  return normalized ? normalized.split(' ') : [];
}

/** 16-character hex SimHash of the text's word 3-shingles (FNV-1a 64-bit). */
function simhash64(text) {
  const tokens = words(text);
  const shingles = [];
  if (tokens.length < SHINGLE_SIZE) shingles.push(tokens.join(' '));
  for (let i = 0; i + SHINGLE_SIZE <= tokens.length; i += 1) shingles.push(tokens.slice(i, i + SHINGLE_SIZE).join(' '));

  const weights = new Array(64).fill(0);
  for (const shingle of shingles) {
    const hash = fnv1a64(shingle);
    for (let bit = 0; bit < 64; bit += 1) weights[bit] += (hash >> BigInt(bit)) & 1n ? 1 : -1;
  }
  let result = 0n;
  for (let bit = 0; bit < 64; bit += 1) if (weights[bit] > 0) result |= 1n << BigInt(bit);
  return result.toString(16).padStart(16, '0');
}

/** Number of differing bits between two 16-hex SimHashes. */
function hamming(a, b) {
  let x = BigInt(`0x${a}`) ^ BigInt(`0x${b}`);
  let count = 0;
  while (x) {
    x &= x - 1n;
    count += 1;
  }
  return count;
}

/** Whether a message is long enough to take part in similar-text linking. */
const isComparable = (text) => words(text).length >= MIN_WORDS_FOR_SIMILARITY;

module.exports = { simhash64, hamming, normalizeForHash, isComparable, fnv1a64, MIN_WORDS_FOR_SIMILARITY };
