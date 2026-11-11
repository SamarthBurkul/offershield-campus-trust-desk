'use strict';

const { createCaseAs } = require('./cases');
const { scamCaseBody, confirmFraud } = require('./registry');
const { createUser } = require('./factories');
const { FraudIndicator } = require('../../src/models/FraudIndicator');

/** A confirmed_fraud case in college A with two active indicators (UPI + domain). */
async function confirmedSource(ctx) {
  const source = await createCaseAs(ctx.studentA, scamCaseBody());
  await confirmFraud(ctx.headA, source.id, [
    { type: 'upi', value: 'infosys.onboard@ybl' },
    { type: 'domain', value: 'infosys-careers.in' },
  ]);
  const indicators = await FraudIndicator.find({ collegeId: ctx.alpha.college._id }).sort({ type: 1 }).lean();
  return { source, indicatorIds: indicators.map((item) => String(item._id)) };
}

const advisoryBody = (overrides = {}) => ({
  title: 'Fraudulent offer using the name "Infosys"',
  body: 'A fake internship offer is asking students to pay an onboarding fee. Genuine recruiters never charge fees. Do not pay.',
  severity: 'critical',
  target: { years: [], branches: [] },
  ...overrides,
});

/** Extra alpha students with various years/branches (setupDesk's students are year 2, COMP). */
async function moreStudents(ctx) {
  const mk = (email, year, branch, extra = {}) => createUser({ college: ctx.alpha.college, role: 'student', email: `${email}@demo-alpha.test.edu`, year, branch, ...extra });
  return {
    y4comp: await mk('y4comp', 4, 'COMP'),
    y4it: await mk('y4it', 4, 'IT'),
    y1it: await mk('y1it', 1, 'IT'),
    disabled: await mk('disabled.student', 4, 'COMP', { status: 'disabled' }),
  };
}

module.exports = { confirmedSource, advisoryBody, moreStudents };
