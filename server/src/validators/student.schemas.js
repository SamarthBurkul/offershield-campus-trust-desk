'use strict';

const { z, branchSchema } = require('./common');

const objectId = z.string().regex(/^[a-f0-9]{24}$/i, { error: 'must be a valid id' });

const studentListQuerySchema = z
  .object({
    status: z.enum(['pending_approval', 'active', 'disabled', 'rejected']).optional(),
    year: z.coerce.number().int().min(1).max(5).optional(),
    branch: branchSchema.optional(),
    q: z.string().trim().min(1).max(100).optional(),
    page: z.coerce.number().int().min(1).max(10_000).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(25),
  })
  .strict();

const rejectStudentSchema = z.object({ reason: z.string().trim().min(1).max(500).optional() }).strict();

const bulkApproveSchema = z
  .object({ ids: z.array(objectId).min(1).max(100).transform((ids) => [...new Set(ids)]) })
  .strict();

const studentStatusSchema = z.object({ status: z.enum(['active', 'disabled']) }).strict();

module.exports = { studentListQuerySchema, rejectStudentSchema, bulkApproveSchema, studentStatusSchema };
