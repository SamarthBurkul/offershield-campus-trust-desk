'use strict';

const mongoose = require('mongoose');

const DEFAULT_BRANCHES = Object.freeze(['COMP', 'IT', 'EXTC', 'MECH', 'CIVIL', 'AIDS']);
const COLLEGE_STATUSES = Object.freeze(['active', 'suspended']);
// email_domain: students self-register with a college address. manual_approval: any address, then staff approve.
const STUDENT_VERIFICATION_MODES = Object.freeze(['email_domain', 'manual_approval']);
const CODE_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const DOMAIN_PATTERN = /^(?=.{3,253}$)([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/;

const collegeSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 200 },
    code: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      minlength: 3,
      maxlength: 20,
      match: CODE_PATTERN,
    },
    emailDomains: {
      type: [{ type: String, lowercase: true, trim: true, match: DOMAIN_PATTERN }],
      validate: { validator: (domains) => domains.length >= 1, message: 'At least one email domain is required' },
    },
    branches: {
      type: [{ type: String, trim: true, uppercase: true, maxlength: 20 }],
      default: () => [...DEFAULT_BRANCHES],
    },
    studentJoinCodeHash: { type: String, required: true, select: false },
    status: { type: String, enum: COLLEGE_STATUSES, default: 'active' },
    studentVerification: { type: String, enum: STUDENT_VERIFICATION_MODES, default: 'email_domain' },
    // Set only by the seed scripts (never accepted by any API schema); demo resets touch only these colleges.
    isDemo: { type: Boolean, default: false },
  },
  { timestamps: true },
);

const College = mongoose.models.College || mongoose.model('College', collegeSchema);

module.exports = { College, DEFAULT_BRANCHES, COLLEGE_STATUSES, STUDENT_VERIFICATION_MODES, CODE_PATTERN, DOMAIN_PATTERN };
