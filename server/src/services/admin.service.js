'use strict';

const mongoose = require('mongoose');
const AppError = require('../utils/AppError');
const { College } = require('../models/College');
const { User, ROLES, STAFF_ROLES } = require('../models/User');
const { userRepository } = require('../repositories');
const { hashPassword } = require('../utils/password');
const { generateJoinCode } = require('../utils/tokens');
const { idOf } = require('../utils/safeUser');
const audit = require('./audit.service');
const staffService = require('./staff.service');

const collegeNotFound = () => new AppError(404, 'NOT_FOUND', 'College not found');

/** Platform view of a college: never students, never the join code or its hash. */
function toCollegeView(college, staffCount) {
  return {
    id: idOf(college._id),
    name: college.name,
    code: college.code,
    emailDomains: [...college.emailDomains],
    branches: [...college.branches],
    status: college.status,
    staffCount,
    createdAt: college.createdAt,
    updatedAt: college.updatedAt,
  };
}

async function findCollegeOr404(id) {
  if (!mongoose.isValidObjectId(id)) throw collegeNotFound();
  const college = await College.findById(id);
  if (!college) throw collegeNotFound();
  return college;
}

const countStaff = (collegeId) => userRepository.forTenant(collegeId).count({ role: { $in: STAFF_ROLES } });

async function issueJoinCode() {
  const studentJoinCode = generateJoinCode();
  return { studentJoinCode, studentJoinCodeHash: await hashPassword(studentJoinCode) };
}

async function createCollege(actor, input, { ip }) {
  if (await College.exists({ code: input.code })) {
    throw new AppError(409, 'COLLEGE_CODE_TAKEN', 'A college with this code already exists');
  }
  const { studentJoinCode, studentJoinCodeHash } = await issueJoinCode();

  let college;
  try {
    college = await College.create({ ...input, studentJoinCodeHash });
  } catch (err) {
    if (err && err.code === 11000) throw new AppError(409, 'COLLEGE_CODE_TAKEN', 'A college with this code already exists');
    throw err;
  }

  await audit.record({
    collegeId: college._id,
    actor,
    action: 'college.create',
    entityType: 'college',
    entityId: college._id,
    metadata: { name: college.name, code: college.code, emailDomains: [...college.emailDomains] },
    ip,
  });

  // The join code is returned exactly once; only its hash is stored.
  return { college: toCollegeView(college, 0), studentJoinCode };
}

async function listColleges() {
  const [colleges, counts] = await Promise.all([
    College.find().sort({ createdAt: -1 }),
    User.aggregate([
      { $match: { role: { $in: STAFF_ROLES } } },
      { $group: { _id: '$collegeId', count: { $sum: 1 } } },
    ]),
  ]);
  const countByCollege = new Map(counts.map((row) => [String(row._id), row.count]));
  return colleges.map((college) => toCollegeView(college, countByCollege.get(String(college._id)) ?? 0));
}

async function getCollege(id) {
  const college = await findCollegeOr404(id);
  return toCollegeView(college, await countStaff(college._id));
}

async function updateCollege(actor, id, changes, { ip }) {
  const college = await findCollegeOr404(id);
  const previousStatus = college.status;
  college.set(changes);
  await college.save();

  const metadata = { fields: Object.keys(changes) };
  if (changes.status && changes.status !== previousStatus) metadata.status = { from: previousStatus, to: changes.status };
  await audit.record({
    collegeId: college._id,
    actor,
    action: 'college.update',
    entityType: 'college',
    entityId: college._id,
    metadata,
    ip,
  });

  return toCollegeView(college, await countStaff(college._id));
}

async function rotateJoinCode(actor, id, { ip }) {
  const college = await findCollegeOr404(id);
  const { studentJoinCode, studentJoinCodeHash } = await issueJoinCode();
  await College.updateOne({ _id: college._id }, { $set: { studentJoinCodeHash } });

  await audit.record({
    collegeId: college._id,
    actor,
    action: 'college.join_code_rotate',
    entityType: 'college',
    entityId: college._id,
    ip,
  });

  return { college: toCollegeView(college, await countStaff(college._id)), studentJoinCode };
}

async function createTpoHead(actor, collegeId, input, { ip }) {
  const college = await findCollegeOr404(collegeId);
  return staffService.createStaffAccount({ college, role: ROLES.TPO_HEAD, ...input, actor, ip });
}

async function listCollegeStaff(collegeId) {
  const college = await findCollegeOr404(collegeId);
  return staffService.listStaff(college._id);
}

module.exports = { createCollege, listColleges, getCollege, updateCollege, rotateJoinCode, createTpoHead, listCollegeStaff };
