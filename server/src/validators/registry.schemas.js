'use strict';

const { z } = require('./common');
const { INDICATOR_TYPES } = require('../constants/caseStatus');
const { RECRUITER_STATUSES, VERIFICATION_METHODS } = require('../models/Recruiter');

const objectId = z.string().regex(/^[a-f0-9]{24}$/i, { error: 'must be a valid id' });
const text = (min, max) => z.string().trim().min(min).max(max);
const page = z.coerce.number().int().min(1).max(10_000).default(1);

const methods = z.array(z.enum(VERIFICATION_METHODS)).min(1).max(VERIFICATION_METHODS.length).transform((list) => [...new Set(list)]);
const evidenceNote = text(20, 2000);
const expiresInDays = z.number().int().min(30).max(730);
const domains = z.array(text(3, 253)).min(1).max(20);
const contactEmails = z.array(text(3, 254)).max(10);
const contactPhones = z.array(text(5, 20)).max(10);

const recruiterListQuerySchema = z
  .object({
    q: text(1, 200).optional(),
    status: z.enum(RECRUITER_STATUSES).optional(),
    page,
    limit: z.coerce.number().int().min(1).max(50).default(20),
  })
  .strict();

const createRecruiterSchema = z
  .object({
    companyName: text(2, 120),
    domains,
    contactEmails: contactEmails.default([]),
    contactPhones: contactPhones.default([]),
    methods,
    evidenceNote,
    expiresInDays: expiresInDays.optional(),
    sourceCaseId: objectId.optional(),
  })
  .strict();

const updateRecruiterSchema = z
  .object({
    companyName: text(2, 120).optional(),
    domains: domains.optional(),
    contactEmails: contactEmails.optional(),
    contactPhones: contactPhones.optional(),
    methods: methods.optional(),
    evidenceNote: evidenceNote.optional(),
    expiresInDays: expiresInDays.optional(),
  })
  .strict()
  .refine((body) => Object.keys(body).length > 0, { error: 'Provide at least one field to update' });

const renewRecruiterSchema = z.object({ methods, evidenceNote, expiresInDays: expiresInDays.optional() }).strict();
const suspendRecruiterSchema = z.object({ reason: text(10, 500) }).strict();

const indicatorListQuerySchema = z
  .object({
    type: z.enum(INDICATOR_TYPES).optional(),
    status: z.enum(['active', 'revoked']).optional(),
    q: text(1, 600).optional(),
    page,
    limit: z.coerce.number().int().min(1).max(100).default(25),
  })
  .strict();

const revokeIndicatorSchema = z.object({ reason: text(10, 500) }).strict();

const linkCaseSchema = z.object({ caseId: objectId }).strict();

module.exports = {
  recruiterListQuerySchema,
  createRecruiterSchema,
  updateRecruiterSchema,
  renewRecruiterSchema,
  suspendRecruiterSchema,
  indicatorListQuerySchema,
  revokeIndicatorSchema,
  linkCaseSchema,
};
