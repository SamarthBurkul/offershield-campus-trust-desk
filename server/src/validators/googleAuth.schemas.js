'use strict';

const { z, collegeCodeSchema, branchSchema } = require('./common');

const googleStartQuerySchema = z
  .object({ intent: z.enum(['login', 'register']).default('login') })
  .strict();

// Google adds its own parameters (scope, authuser, hd, prompt); only these are read.
const googleCallbackQuerySchema = z.object({
  code: z.string().min(1).max(2048).optional(),
  state: z.string().min(1).max(256).optional(),
  error: z.string().max(200).optional(),
});

const googleCompleteSchema = z
  .object({
    collegeCode: collegeCodeSchema,
    joinCode: z.string().trim().min(1, { error: 'is required' }).max(64),
    year: z.number().int().min(1).max(5),
    branch: branchSchema,
    acceptPolicies: z.literal(true, { error: 'You must accept the privacy notice and terms' }),
  })
  .strict();

module.exports = { googleStartQuerySchema, googleCallbackQuerySchema, googleCompleteSchema };
