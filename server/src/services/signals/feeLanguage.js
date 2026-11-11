'use strict';

// The single list of fee and urgency phrases used by warning signals (English and Hinglish).
// Matching is case-insensitive on whole phrases.
const FEE_PHRASES = Object.freeze([
  'registration fee',
  'registration charges',
  'security deposit',
  'refundable deposit',
  'refundable fee',
  'training fee',
  'onboarding fee',
  'joining fee',
  'processing fee',
  'kit charges',
  'verification charges',
  'verification fee',
  'pay ₹',
  'pay rs',
  'fees lagegi',
  'fee lagegi',
  'pay karna hoga',
  'paise jama',
]);

const URGENCY_PHRASES = Object.freeze([
  'within 24 hours',
  'within 24 hrs',
  'within 48 hours',
  'today only',
  'limited seats',
  'limited slots',
  'immediately',
  'last chance',
  'last date today',
  'abhi pay',
  'jaldi karo',
  'urgent',
]);

const escape = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const toPattern = (phrases) => new RegExp(`(^|[^\\p{L}])(${phrases.map(escape).join('|')})(?![\\p{L}])`, 'iu');

const FEE_PATTERN = toPattern(FEE_PHRASES);
const URGENCY_PATTERN = toPattern(URGENCY_PHRASES);

/** The first matching phrase (lowercase) or null. */
function findPhrase(pattern, text) {
  const match = pattern.exec(String(text ?? ''));
  return match ? match[2].toLowerCase() : null;
}

module.exports = {
  FEE_PHRASES,
  URGENCY_PHRASES,
  findFeePhrase: (text) => findPhrase(FEE_PATTERN, text),
  findUrgencyPhrase: (text) => findPhrase(URGENCY_PATTERN, text),
};
