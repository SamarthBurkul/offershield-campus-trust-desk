'use strict';

const { setupTwoColleges, createCaseAs } = require('./cases');
const { createUser } = require('./factories');

/**
 * Two colleges with staff, plus a second alpha officer and a disabled alpha officer.
 * `caseA` / `caseB` are one student case per college (created through the API).
 */
async function setupDesk(app) {
  const ctx = await setupTwoColleges(app);
  ctx.alpha.officer2 = await createUser({ college: ctx.alpha.college, role: 'placement_officer', email: 'officer2@demo-alpha.test.edu' });
  ctx.alpha.disabledOfficer = await createUser({
    college: ctx.alpha.college,
    role: 'placement_officer',
    email: 'disabled@demo-alpha.test.edu',
    status: 'disabled',
  });

  ctx.studentA = await ctx.as('student@demo-alpha.test.edu');
  ctx.headA = await ctx.as('head@demo-alpha.test.edu');
  ctx.officerA = await ctx.as('officer@demo-alpha.test.edu');
  ctx.headB = await ctx.as('head@demo-beta.test.edu');
  ctx.officerB = await ctx.as('officer@demo-beta.test.edu');

  ctx.caseA = await createCaseAs(ctx.studentA);
  ctx.caseB = await createCaseAs(await ctx.as('student@demo-beta.test.edu'));
  return ctx;
}

const BASIS = 'Called the official HR number listed on the company website; they confirmed no such internship exists.';

const fraudDecision = (overrides = {}) => ({
  type: 'confirmed_fraud',
  basis: BASIS,
  checks: ['called_official_number', 'reviewed_student_evidence'],
  studentMessage: 'This offer is not genuine. Please do not pay or share documents.',
  confirmedIndicators: [{ type: 'upi', value: 'hr.pay@okaxis' }],
  ...overrides,
});

module.exports = { setupDesk, fraudDecision, BASIS, createCaseAs };
