'use strict';

const AppError = require('../utils/AppError');
const { User, ROLES } = require('../models/User');
const { College } = require('../models/College');
const { userRepository } = require('../repositories');
const { toSafeUser } = require('../utils/safeUser');
const audit = require('./audit.service');

const PREF_KEYS = Object.freeze(['caseUpdates', 'advisories', 'staffAlerts']);

function toAccountView(user) {
  const prefs = user.emailPrefs ?? {};
  return {
    ...toSafeUser(user),
    hasPassword: Boolean(user.passwordHash),
    // Students do not receive staff alerts, so the toggle is only offered to staff.
    emailPrefs: Object.fromEntries(PREF_KEYS.map((key) => [key, prefs[key] !== false])),
  };
}

const loadUser = (sessionUser) =>
  sessionUser.collegeId
    ? userRepository.forTenant(sessionUser.collegeId).findOne({ _id: sessionUser.id }, { select: '+passwordHash', lean: true })
    : User.findOne({ _id: sessionUser.id, role: ROLES.SUPER_ADMIN }).select('+passwordHash').lean();

async function getAccount(sessionUser) {
  const user = await loadUser(sessionUser);
  if (!user) throw new AppError(401, 'UNAUTHENTICATED', 'Authentication required');
  return toAccountView(user);
}

/**
 * Self-service profile: name for everyone; year and branch for students (branch must be one the
 * college offers); email preferences. Profile changes are audited with field names only.
 */
async function updateAccount(sessionUser, input, { ip }) {
  const user = await loadUser(sessionUser);
  if (!user) throw new AppError(401, 'UNAUTHENTICATED', 'Authentication required');
  const isStudent = user.role === ROLES.STUDENT;
  if (!isStudent && (input.year !== undefined || input.branch !== undefined)) {
    throw new AppError(400, 'VALIDATION_ERROR', 'Invalid request: year and branch apply to students only');
  }
  if (input.branch !== undefined) {
    const college = await College.findById(user.collegeId).select('branches').lean();
    if (!college?.branches.includes(input.branch)) {
      throw new AppError(400, 'VALIDATION_ERROR', 'Invalid request: branch: is not offered by this college');
    }
  }

  const set = {};
  const changed = [];
  for (const key of ['name', 'year', 'branch']) {
    if (input[key] !== undefined && input[key] !== user[key]) {
      set[key] = input[key];
      changed.push(key);
    }
  }
  for (const [key, value] of Object.entries(input.emailPrefs ?? {})) set[`emailPrefs.${key}`] = value;

  if (Object.keys(set).length) {
    if (user.collegeId) await userRepository.forTenant(user.collegeId).updateOne({ _id: user._id }, { $set: set });
    else await User.updateOne({ _id: user._id, role: ROLES.SUPER_ADMIN }, { $set: set });
  }
  if (changed.length) {
    await audit.record({
      collegeId: user.collegeId,
      actor: { id: user._id, role: user.role },
      action: 'user.profile_update',
      entityType: 'user',
      entityId: user._id,
      metadata: { fields: changed },
      ip,
    });
  }
  return getAccount(sessionUser);
}

module.exports = { getAccount, updateAccount, toAccountView };
