'use strict';

const { College } = require('../../src/models/College');
const { User, ROLES } = require('../../src/models/User');
const { hashPassword } = require('../../src/utils/password');
const { normalizeJoinCode } = require('../../src/utils/tokens');

// Test-only credentials.
const TEST_PASSWORD = 'TestPassw0rd-1';
const TEST_JOIN_CODE = 'TESTJOIN42';

// bcrypt at cost 12 is slow, so each distinct value is hashed once per test file.
const hashCache = new Map();
function cachedHash(value) {
  if (!hashCache.has(value)) hashCache.set(value, hashPassword(value));
  return hashCache.get(value);
}

async function createCollege({ code = 'alpha', domain = `${code}.test.edu`, joinCode = TEST_JOIN_CODE, ...rest } = {}) {
  const college = await College.create({
    name: `${code} College`,
    code,
    emailDomains: [domain],
    studentJoinCodeHash: await cachedHash(normalizeJoinCode(joinCode)),
    ...rest,
  });
  return { college, domain, joinCode };
}

async function createUser({ college = null, role, email, password = TEST_PASSWORD, ...rest }) {
  const studentDefaults = role === ROLES.STUDENT ? { year: 2, branch: 'COMP' } : {};
  return User.create({
    collegeId: college ? college._id : null,
    role,
    name: `${role} ${email}`,
    email,
    passwordHash: password === null ? null : await cachedHash(password),
    emailVerifiedAt: new Date(),
    ...studentDefaults,
    ...rest,
  });
}

/** A college with one TPO head, one placement officer and one student. */
async function createCollegeWithMembers(code) {
  const { college, domain, joinCode } = await createCollege({ code });
  const [head, officer, student] = await Promise.all([
    createUser({ college, role: ROLES.TPO_HEAD, email: `head@${domain}` }),
    createUser({ college, role: ROLES.PLACEMENT_OFFICER, email: `officer@${domain}` }),
    createUser({ college, role: ROLES.STUDENT, email: `student@${domain}` }),
  ]);
  return { college, domain, joinCode, head, officer, student };
}

function createSuperAdmin(email = 'root@platform.test') {
  return createUser({ role: ROLES.SUPER_ADMIN, email });
}

module.exports = {
  TEST_PASSWORD,
  TEST_JOIN_CODE,
  createCollege,
  createUser,
  createCollegeWithMembers,
  createSuperAdmin,
};
