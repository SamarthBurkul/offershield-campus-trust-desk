'use strict';

const { z } = require('./common');
const {
  CASE_STATUSES,
  CHANNELS,
  PRIORITIES,
  DECISION_TYPES,
  DECISION_CHECKS,
  DISMISS_REASONS,
  INDICATOR_TYPES,
} = require('../constants/caseStatus');

const objectId = z.string().regex(/^[a-f0-9]{24}$/i, { error: 'must be a valid id' });
const optionalDate = z.coerce.date({ error: 'must be a valid date' }).optional();
const text = (min, max) => z.string().trim().min(min).max(max);

const queueQuerySchema = z
  .object({
    status: z.enum([...CASE_STATUSES, 'open', 'closed']).optional(),
    priority: z.enum(PRIORITIES).optional(),
    assignee: z.union([z.enum(['me', 'unassigned']), objectId]).optional(),
    channel: z.enum(CHANNELS).optional(),
    q: z.string().trim().min(1).max(200).optional(),
    from: optionalDate,
    to: optionalDate,
    sort: z.enum(['lastActivity', 'created', 'priority']).default('lastActivity'),
    page: z.coerce.number().int().min(1).max(10_000).default(1),
    limit: z.coerce.number().int().min(1).max(50).default(20),
  })
  .strict();

const assignSchema = z.object({ assigneeId: objectId.nullable() }).strict();

// Only the non-final transition is possible here; final statuses fail validation.
const statusSchema = z.object({ status: z.literal('under_review'), reason: text(1, 500).optional() }).strict();

const infoRequestSchema = z.object({ message: text(10, 2000) }).strict();
const staffMessageSchema = z.object({ body: text(1, 3000) }).strict();
const noteSchema = z.object({ body: text(1, 5000) }).strict();
const recommendationSchema = z.object({ type: z.enum(DECISION_TYPES), basis: text(10, 2000) }).strict();
const reopenSchema = z.object({ reason: text(10, 1000) }).strict();

const STRONG_TYPES = ['confirmed_fraud', 'verified_genuine'];

const decisionSchema = z
  .object({
    type: z.enum(DECISION_TYPES),
    basis: text(10, 3000),
    checks: z.array(z.enum(DECISION_CHECKS)).max(DECISION_CHECKS.length).default([]),
    studentMessage: text(10, 1000),
    confirmedIndicators: z
      .array(z.object({ type: z.enum(INDICATOR_TYPES), value: text(1, 600) }).strict())
      .max(50)
      .default([]),
    verifiedDomains: z.array(text(1, 253)).max(20).default([]),
    dismissReason: z.enum(DISMISS_REASONS).optional(),
    duplicateOfCaseId: objectId.optional(),
  })
  .strict()
  .superRefine((body, ctx) => {
    const issue = (path, message) => ctx.addIssue({ code: 'custom', path: [path], message });
    if (STRONG_TYPES.includes(body.type)) {
      if (body.basis.length < 30) issue('basis', `must be at least 30 characters for ${body.type}`);
      if (body.checks.length === 0) issue('checks', `select at least one check for ${body.type}`);
    }
    if (body.type === 'confirmed_fraud' && body.confirmedIndicators.length === 0) {
      issue('confirmedIndicators', 'select at least one confirmed indicator');
    }
    if (body.type !== 'confirmed_fraud' && body.confirmedIndicators.length > 0) {
      issue('confirmedIndicators', 'only applies to confirmed_fraud');
    }
    if (body.type !== 'verified_genuine' && body.verifiedDomains.length > 0) {
      issue('verifiedDomains', 'only applies to verified_genuine');
    }
    if (body.type === 'dismissed' && !body.dismissReason) issue('dismissReason', 'is required for dismissed');
    if (body.type !== 'dismissed' && body.dismissReason) issue('dismissReason', 'only applies to dismissed');
    if (body.dismissReason === 'duplicate' && !body.duplicateOfCaseId) {
      issue('duplicateOfCaseId', 'is required when the reason is duplicate');
    }
    if (body.duplicateOfCaseId && body.dismissReason !== 'duplicate') issue('duplicateOfCaseId', 'only applies to duplicate dismissals');
  });

const auditQuerySchema = z
  .object({
    action: z.string().trim().regex(/^[a-z_]+\.[a-z_]+$/, { error: 'must look like case.decision' }).optional(),
    entityType: z.string().trim().regex(/^[a-z_]{1,50}$/).optional(),
    entityId: objectId.optional(),
    actorId: objectId.optional(),
    from: optionalDate,
    to: optionalDate,
    page: z.coerce.number().int().min(1).max(10_000).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(25),
  })
  .strict();

module.exports = {
  queueQuerySchema,
  assignSchema,
  statusSchema,
  infoRequestSchema,
  staffMessageSchema,
  noteSchema,
  recommendationSchema,
  decisionSchema,
  reopenSchema,
  auditQuerySchema,
};
