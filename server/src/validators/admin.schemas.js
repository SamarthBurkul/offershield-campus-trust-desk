'use strict';

const { z, nameSchema, emailSchema, collegeCodeSchema, emailDomainsSchema, branchesSchema } = require('./common');
const { COLLEGE_STATUSES } = require('../models/College');

const createCollegeSchema = z
  .object({
    name: nameSchema.max(200),
    code: collegeCodeSchema,
    emailDomains: emailDomainsSchema,
    branches: branchesSchema.optional(),
  })
  .strict();

const updateCollegeSchema = z
  .object({
    name: nameSchema.max(200).optional(),
    emailDomains: emailDomainsSchema.optional(),
    branches: branchesSchema.optional(),
    status: z.enum(COLLEGE_STATUSES).optional(),
  })
  .strict()
  .refine((body) => Object.keys(body).length > 0, { error: 'Provide at least one field to update' });

const createStaffSchema = z.object({ name: nameSchema, email: emailSchema }).strict();

const emptyBodySchema = z.object({}).strict();

module.exports = { createCollegeSchema, updateCollegeSchema, createStaffSchema, emptyBodySchema };
