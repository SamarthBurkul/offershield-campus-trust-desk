'use strict';

const { z } = require('./common');
const { CASE_STATUSES, CHANNELS, MONEY_PURPOSES } = require('../constants/caseStatus');

const CLOCK_SKEW_MS = 5 * 60 * 1000;

const optionalText = (max) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((value) => (value ? value : null));

const linkSchema = z
  .string()
  .trim()
  .max(500)
  .refine(
    (value) => {
      try {
        return ['http:', 'https:'].includes(new URL(value).protocol);
      } catch {
        return false;
      }
    },
    { error: 'must be an http:// or https:// link' },
  );

const contactsSchema = z
  .object({
    emails: z.array(z.string().trim().toLowerCase().max(254).pipe(z.email({ error: 'must be a valid email address' }))).max(5).default([]),
    phones: z
      .array(z.string().trim().regex(/^\+?[0-9][0-9 -]{5,18}$/, { error: 'must be a phone number (digits, spaces, -, optional +)' }))
      .max(5)
      .default([]),
    upiIds: z
      .array(z.string().trim().toLowerCase().regex(/^[a-z0-9._-]{2,256}@[a-z][a-z0-9]{1,63}$/, { error: 'must look like name@bank' }))
      .max(5)
      .default([]),
  })
  .strict();

const moneyRequestedSchema = z
  .object({
    requested: z.boolean(),
    amount: z.number().min(0).max(100_000_000).nullable().optional(),
    purpose: z.enum(MONEY_PURPOSES).nullable().optional(),
  })
  .strict()
  // Amount and purpose only make sense when money was requested.
  .transform(({ requested, amount, purpose }) =>
    requested ? { requested, amount: amount ?? null, purpose: purpose ?? null } : { requested, amount: null, purpose: null },
  );

const createCaseSchema = z
  .object({
    claimedCompany: z.string().trim().min(2).max(120),
    roleTitle: optionalText(120),
    channel: z.enum(CHANNELS),
    receivedAt: z.coerce
      .date({ error: 'must be a valid date' })
      .refine((date) => date.getTime() <= Date.now() + CLOCK_SKEW_MS, { error: 'cannot be in the future' })
      .refine((date) => date.getFullYear() >= 2000, { error: 'is too far in the past' }),
    messageText: z.string().trim().min(10).max(5000),
    links: z.array(linkSchema).max(10).default([]),
    contacts: contactsSchema.default({ emails: [], phones: [], upiIds: [] }),
    moneyRequested: moneyRequestedSchema,
    paidAlready: z.boolean(),
    documentsShared: z.boolean(),
    studentNote: optionalText(2000),
    consent: z.literal(true, { error: 'You must confirm consent to submit a request' }),
  })
  .strict();

const caseMessageSchema = z.object({ body: z.string().trim().min(1).max(3000) }).strict();

const listMyCasesQuerySchema = z
  .object({
    status: z.enum(CASE_STATUSES).optional(),
    page: z.coerce.number().int().min(1).max(10_000).default(1),
    limit: z.coerce.number().int().min(1).max(50).default(10),
  })
  .strict();

module.exports = { createCaseSchema, caseMessageSchema, listMyCasesQuerySchema };
