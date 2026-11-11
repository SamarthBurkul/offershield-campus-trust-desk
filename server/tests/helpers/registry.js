'use strict';

const { validCaseBody } = require('./cases');

const recruiterBody = (overrides = {}) => ({
  companyName: 'Infosys',
  domains: ['infosys.com'],
  contactEmails: ['campus.hr@infosys.com'],
  contactPhones: ['+91 91111 22222'],
  methods: ['called_official_number', 'checked_official_careers_page'],
  evidenceNote: 'Called the HR number listed on the official infosys.com careers page.',
  ...overrides,
});

const SCAM_TEXT =
  'Dear Rahul, congratulations! You have been selected for the Infosys remote internship. To confirm your seat pay a refundable onboarding fee of Rs 999 to infosys.onboard@ybl within 24 hours. Contact HR at hr.infosys.careers@gmail.com. Limited seats.';

/** A scam-like case body claiming Infosys from gmail with a look-alike link and a UPI fee demand. */
const scamCaseBody = (overrides = {}) =>
  validCaseBody({
    claimedCompany: 'Infosys',
    roleTitle: 'Remote Intern',
    channel: 'whatsapp',
    messageText: SCAM_TEXT,
    links: ['https://infosys-careers.in/apply'],
    contacts: { emails: ['hr.infosys.careers@gmail.com'], phones: [], upiIds: ['infosys.onboard@ybl'] },
    moneyRequested: { requested: true, amount: 999, purpose: 'registration' },
    ...overrides,
  });

/** A plain case with its own unique contacts so it does not link to anything by accident. */
const plainCaseBody = (tag, overrides = {}) =>
  validCaseBody({
    claimedCompany: `Plain Co ${tag}`,
    messageText: `Short note number ${tag} about an interview slot.`,
    links: [],
    contacts: { emails: [], phones: [], upiIds: [] },
    ...overrides,
  });

const fraudDecisionFor = (confirmedIndicators, overrides = {}) => ({
  type: 'confirmed_fraud',
  basis: 'Called the official HR line; the company never charges fees and does not use this UPI.',
  checks: ['called_official_number'],
  studentMessage: 'This offer is fraudulent. Do not pay anything.',
  confirmedIndicators,
  ...overrides,
});

async function createRecruiter(agent, overrides) {
  const res = await agent.post('/api/v1/staff/registry/recruiters').send(recruiterBody(overrides));
  if (res.status !== 201) throw new Error(`recruiter creation failed: ${res.status} ${JSON.stringify(res.body)}`);
  return res.body.recruiter;
}

async function confirmFraud(agent, caseId, confirmedIndicators) {
  const res = await agent.post(`/api/v1/staff/cases/${caseId}/decision`).send(fraudDecisionFor(confirmedIndicators));
  if (res.status !== 200) throw new Error(`decision failed: ${res.status} ${JSON.stringify(res.body)}`);
  return res.body.case;
}

module.exports = { recruiterBody, scamCaseBody, plainCaseBody, fraudDecisionFor, createRecruiter, confirmFraud, SCAM_TEXT };
