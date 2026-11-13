'use strict';

const { z, nameSchema, emailSchema, collegeCodeSchema, branchSchema } = require('./common');
const { passwordSchema } = require('../utils/password');

const registerSchema = z
  .object({
    name: nameSchema,
    email: emailSchema,
    password: passwordSchema,
    collegeCode: collegeCodeSchema,
    joinCode: z.string().trim().min(1, { error: 'is required' }).max(64),
    year: z.number().int().min(1).max(5),
    branch: branchSchema,
    // Consent to the privacy notice and terms is required; the accepted version is stored on the user.
    acceptPolicies: z.literal(true, { error: 'You must accept the privacy notice and terms' }),
  })
  .strict();

const loginSchema = z
  .object({
    email: z.string().trim().toLowerCase().min(1, { error: 'is required' }).max(254),
    password: z.string().min(1, { error: 'is required' }).max(200),
  })
  .strict();

const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, { error: 'is required' }).max(200),
    newPassword: passwordSchema,
  })
  .strict();

module.exports = { registerSchema, loginSchema, changePasswordSchema };

const verifyEmailSchema = z
  .object({ code: z.string().trim().regex(/^\d{6}$/, { error: 'must be 6 digits' }) })
  .strict();

const forgotPasswordSchema = z.object({ email: z.string().trim().toLowerCase().min(1, { error: 'is required' }).max(254) }).strict();

const resetPasswordSchema = z
  .object({
    token: z.string().trim().min(20).max(200).regex(/^[A-Za-z0-9_-]+$/, { error: 'is not valid' }),
    newPassword: passwordSchema,
  })
  .strict();

module.exports.verifyEmailSchema = verifyEmailSchema;
module.exports.forgotPasswordSchema = forgotPasswordSchema;
module.exports.resetPasswordSchema = resetPasswordSchema;
