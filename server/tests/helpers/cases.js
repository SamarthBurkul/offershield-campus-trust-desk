'use strict';

const { TEST_PASSWORD, createCollegeWithMembers, createUser } = require('./factories');
const { loginAgent } = require('./auth');

/** A valid POST /cases body; override any field. */
function validCaseBody(overrides = {}) {
  return {
    claimedCompany: 'Tata Consultancy Services',
    roleTitle: 'Software Intern',
    channel: 'whatsapp',
    receivedAt: new Date(Date.now() - 24 * 3600 * 1000).toISOString(),
    messageText: 'Congratulations! You are selected. Pay registration at hr.pay@okaxis and visit tcs-careers.in',
    links: ['https://tcs-careers.in/offer'],
    contacts: { emails: ['hr@tcs-careers.in'], phones: ['+91 98765 43210'], upiIds: [] },
    moneyRequested: { requested: false },
    paidAlready: false,
    documentsShared: false,
    consent: true,
    ...overrides,
  };
}

/**
 * Two colleges ("demo-alpha", "demo-beta") with staff and a student each, plus a second alpha student.
 * Returns logged-in agents factory and the raw records.
 */
async function setupTwoColleges(app) {
  const alpha = await createCollegeWithMembers('demo-alpha');
  const beta = await createCollegeWithMembers('demo-beta');
  alpha.student2 = await createUser({ college: alpha.college, role: 'student', email: `student2@${alpha.domain}` });
  const as = (email) => loginAgent(app, email, TEST_PASSWORD);
  return { alpha, beta, as };
}

async function createCaseAs(agent, overrides) {
  const res = await agent.post('/api/v1/cases').send(validCaseBody(overrides));
  if (res.status !== 201) throw new Error(`case creation failed: ${res.status} ${JSON.stringify(res.body)}`);
  return res.body.case;
}

module.exports = { validCaseBody, setupTwoColleges, createCaseAs };
