'use strict';

const { z } = require('zod');
const { CODE_PATTERN, DOMAIN_PATTERN } = require('../models/College');

const nameSchema = z.string().trim().min(1, { error: 'is required' }).max(120);

const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .max(254)
  .pipe(z.email({ error: 'must be a valid email address' }));

const collegeCodeSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(3)
  .max(20)
  .regex(CODE_PATTERN, { error: 'must be a lowercase slug (letters, digits and single dashes)' });

const domainSchema = z
  .string()
  .trim()
  .toLowerCase()
  .regex(DOMAIN_PATTERN, { error: 'must be a domain such as college.edu' });

const branchSchema = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z0-9&-]{1,20}$/, { error: 'must be 1-20 letters, digits, & or -' });

const unique = (values) => [...new Set(values)];

const emailDomainsSchema = z.array(domainSchema).min(1).max(10).transform(unique);
const branchesSchema = z.array(branchSchema).min(1).max(50).transform(unique);

module.exports = { z, nameSchema, emailSchema, collegeCodeSchema, emailDomainsSchema, branchSchema, branchesSchema };
