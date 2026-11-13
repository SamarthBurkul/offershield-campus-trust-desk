'use strict';

const { z, nameSchema, branchSchema } = require('./common');

const emailPrefsSchema = z
  .object({
    caseUpdates: z.boolean().optional(),
    advisories: z.boolean().optional(),
    staffAlerts: z.boolean().optional(),
  })
  .strict();

// Email is never editable here; year and branch apply to students only (checked in the service).
const updateAccountSchema = z
  .object({
    name: nameSchema.optional(),
    year: z.number().int().min(1).max(5).optional(),
    branch: branchSchema.optional(),
    emailPrefs: emailPrefsSchema.optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, { error: 'at least one field is required' });

module.exports = { updateAccountSchema };
