'use strict';

const { z } = require('./common');
const { ADVISORY_SEVERITIES, ADVISORY_STATUSES } = require('../models/Advisory');

const objectId = z.string().regex(/^[a-f0-9]{24}$/i, { error: 'must be a valid id' });
const text = (min, max) => z.string().trim().min(min).max(max);

const targetSchema = z
  .object({
    years: z.array(z.number().int().min(1).max(5)).max(5).default([]),
    branches: z.array(z.string().trim().toUpperCase().regex(/^[A-Z0-9&-]{1,20}$/)).max(50).default([]),
  })
  .strict();

const fields = {
  title: text(5, 120),
  body: text(20, 3000),
  severity: z.enum(ADVISORY_SEVERITIES).default('warning'),
  target: targetSchema.default({ years: [], branches: [] }),
  indicatorIds: z.array(objectId).max(20).default([]),
  sourceCaseId: objectId.nullable().optional(),
  expiresAt: z.coerce.date().nullable().optional(),
};

const createAdvisorySchema = z.object(fields).strict();

const updateAdvisorySchema = z
  .object({
    title: fields.title.optional(),
    body: fields.body.optional(),
    severity: z.enum(ADVISORY_SEVERITIES).optional(),
    target: targetSchema.optional(),
    indicatorIds: z.array(objectId).max(20).optional(),
    sourceCaseId: objectId.nullable().optional(),
    expiresAt: z.coerce.date().nullable().optional(),
  })
  .strict()
  .refine((body) => Object.keys(body).length > 0, { error: 'Provide at least one field to update' });

const withdrawSchema = z.object({ reason: text(10, 500) }).strict();

const page = z.coerce.number().int().min(1).max(10_000).default(1);

const staffListQuerySchema = z
  .object({ status: z.enum(ADVISORY_STATUSES).optional(), page, limit: z.coerce.number().int().min(1).max(50).default(20) })
  .strict();

// ?years=1,2&branches=COMP,IT (comma-separated; empty = all)
const csv = (item) =>
  z
    .string()
    .optional()
    .transform((value) => (value ? value.split(',').map((part) => part.trim()).filter(Boolean) : []))
    .pipe(z.array(item).max(50));

const audienceQuerySchema = z
  .object({
    years: csv(z.coerce.number().int().min(1).max(5)),
    branches: csv(z.string().toUpperCase().regex(/^[A-Z0-9&-]{1,20}$/)),
  })
  .strict();

module.exports = { createAdvisorySchema, updateAdvisorySchema, withdrawSchema, staffListQuerySchema, audienceQuerySchema };
