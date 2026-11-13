'use strict';

const { College } = require('../../src/models/College');
const { User, ROLES } = require('../../src/models/User');
const { hashPassword, verifyPassword } = require('../../src/utils/password');
const { normalizeJoinCode } = require('../../src/utils/tokens');
const { POLICIES_VERSION } = require('../../src/constants/policies');

// Fixed, public demo values. Not secrets: they exist only for local demos.
const DEMO_COLLEGES = Object.freeze([
  { code: 'demo-alpha', name: 'Demo Alpha Institute of Technology', domain: 'alpha.demo.edu', joinCode: 'ALPHA-DEMO-2026', label: 'Alpha' },
  { code: 'demo-beta', name: 'Demo Beta College of Engineering', domain: 'beta.demo.edu', joinCode: 'BETA-DEMO-2026', label: 'Beta' },
]);

function demoUsers(domain, label) {
  return [
    { role: ROLES.TPO_HEAD, name: `${label} TPO Head`, email: `tpo.head@${domain}` },
    { role: ROLES.PLACEMENT_OFFICER, name: `${label} Placement Officer`, email: `placement.officer@${domain}` },
    { role: ROLES.STUDENT, name: `${label} Student One`, email: `student1@${domain}`, year: 3, branch: 'COMP' },
    { role: ROLES.STUDENT, name: `${label} Student Two`, email: `student2@${domain}`, year: 4, branch: 'IT' },
  ];
}

async function ensureCollege(spec, log) {
  let college = await College.findOne({ code: spec.code }).select('+studentJoinCodeHash');
  if (college) {
    // Older databases created these before isDemo existed; mark them so demo resets can find them.
    if (college.isDemo !== true) await College.updateOne({ _id: college._id }, { $set: { isDemo: true } });
    const joinCodeValid = await verifyPassword(normalizeJoinCode(spec.joinCode), college.studentJoinCodeHash);
    log(`  college ${spec.code}: already exists${joinCodeValid ? '' : ' (join code was rotated; the demo join code no longer works)'}`);
    return college;
  }
  college = await College.create({
    name: spec.name,
    code: spec.code,
    emailDomains: [spec.domain],
    studentJoinCodeHash: await hashPassword(normalizeJoinCode(spec.joinCode)),
    isDemo: true,
  });
  log(`  college ${spec.code}: created`);
  return college;
}

/**
 * Idempotently create the two small demo colleges (alpha, beta) with staff and students.
 * @returns {Promise<Array<{ college: string, role: string, email: string, result: string }>>}
 */
async function seedDemoColleges(demoPassword, { log = console.log } = {}) {
  const passwordHash = await hashPassword(demoPassword);
  const summary = [];
  for (const spec of DEMO_COLLEGES) {
    const college = await ensureCollege(spec, log);
    for (const account of demoUsers(spec.domain, spec.label)) {
      const exists = await User.exists({ email: account.email });
      if (!exists) {
        await User.create({
          ...account,
          collegeId: college._id,
          passwordHash,
          mustChangePassword: false,
          emailVerifiedAt: new Date(),
          policiesAcceptedAt: new Date(),
          policiesVersion: POLICIES_VERSION,
        });
      }
      summary.push({ college: spec.code, role: account.role, email: account.email, result: exists ? 'exists' : 'created' });
    }
  }
  return summary;
}

module.exports = { DEMO_COLLEGES, seedDemoColleges };
