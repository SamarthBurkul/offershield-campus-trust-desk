'use strict';

const mongoose = require('mongoose');
const { College } = require('./College');

const ROLES = Object.freeze({
  STUDENT: 'student',
  PLACEMENT_OFFICER: 'placement_officer',
  TPO_HEAD: 'tpo_head',
  SUPER_ADMIN: 'super_admin',
});
const ROLE_VALUES = Object.freeze(Object.values(ROLES));
const STAFF_ROLES = Object.freeze([ROLES.TPO_HEAD, ROLES.PLACEMENT_OFFICER]);
const USER_STATUSES = Object.freeze(['active', 'disabled']);

const userSchema = new mongoose.Schema(
  {
    collegeId: { type: mongoose.Schema.Types.ObjectId, ref: 'College', default: null },
    role: { type: String, enum: ROLE_VALUES, required: true },
    name: { type: String, required: true, trim: true, maxlength: 120 },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true, maxlength: 254 },
    passwordHash: { type: String, required: true, select: false },
    status: { type: String, enum: USER_STATUSES, default: 'active' },
    mustChangePassword: { type: Boolean, default: false },
    tokenVersion: { type: Number, default: 0, min: 0 },
    year: { type: Number, min: 1, max: 5, default: undefined },
    branch: { type: String, trim: true, uppercase: true, default: undefined },
    lastLoginAt: { type: Date, default: null },
  },
  { timestamps: true },
);

userSchema.index({ collegeId: 1, role: 1 });

// Tenancy and student-profile invariants are enforced here so no code path can bypass them.
userSchema.pre('validate', async function enforceTenancyRules() {
  if (this.role === ROLES.SUPER_ADMIN) {
    if (this.collegeId != null) this.invalidate('collegeId', 'super_admin must not belong to a college');
  } else if (this.collegeId == null) {
    this.invalidate('collegeId', 'collegeId is required for college users');
  }

  if (this.role === ROLES.STUDENT) {
    if (this.year == null) this.invalidate('year', 'year is required for students');
    if (!this.branch) {
      this.invalidate('branch', 'branch is required for students');
    } else if (this.collegeId && (this.isNew || this.isModified('branch'))) {
      const college = await College.findById(this.collegeId).select('branches').lean();
      if (!college || !college.branches.includes(this.branch)) {
        this.invalidate('branch', 'branch is not offered by this college');
      }
    }
  } else {
    if (this.year != null) this.invalidate('year', 'year applies to students only');
    if (this.branch != null) this.invalidate('branch', 'branch applies to students only');
  }
});

const User = mongoose.models.User || mongoose.model('User', userSchema);

module.exports = { User, ROLES, ROLE_VALUES, STAFF_ROLES, USER_STATUSES };
