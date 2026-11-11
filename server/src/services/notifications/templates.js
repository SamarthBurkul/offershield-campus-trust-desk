'use strict';

/**
 * The ONLY source of notification text. Each template receives a small, explicit context
 * (case number, claimed company, the student-visible decision message, advisory title/severity)
 * and nothing else: never a decision basis, checks, notes, recommendation basis, reopen reason,
 * signals or related cases.
 */
const ALLOWED_FIELDS = Object.freeze(['caseNumber', 'claimedCompany', 'studentMessage', 'advisoryTitle', 'severity']);
const MAX_STUDENT_MESSAGE = 200;

const truncate = (value, max) => {
  const text = String(value ?? '').replace(/\s+/g, ' ').trim();
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
};

const company = (c) => (c.claimedCompany ? ` (${truncate(c.claimedCompany, 60)})` : '');

const TEMPLATES = Object.freeze({
  case_submitted: (c) => ({
    title: `New request ${c.caseNumber}`,
    body: `A student submitted a verification request${company(c)}.`,
  }),
  case_student_reply: (c) => ({
    title: `Student replied on ${c.caseNumber}`,
    body: `The student added a reply to request ${c.caseNumber}${company(c)}.`,
  }),
  case_info_requested: (c) => ({
    title: 'Your placement cell needs more information',
    body: `Please reply to your request ${c.caseNumber}${company(c)} so it can be reviewed.`,
  }),
  case_staff_message: (c) => ({
    title: 'New message from your placement cell',
    body: `There is a new message on your request ${c.caseNumber}${company(c)}.`,
  }),
  case_decision: (c) => ({
    title: `Outcome recorded for ${c.caseNumber}`,
    body: truncate(`Your placement cell recorded an outcome: ${truncate(c.studentMessage, MAX_STUDENT_MESSAGE)}`, 300),
  }),
  case_reopened: (c) => ({
    title: `Request ${c.caseNumber} reopened`,
    body: 'Your request has been reopened for further review.',
  }),
  case_assigned: (c) => ({
    title: `Case ${c.caseNumber} assigned to you`,
    body: `You are now the assignee for ${c.caseNumber}${company(c)}.`,
  }),
  case_recommendation: (c) => ({
    title: `Recommendation added on ${c.caseNumber}`,
    body: `A placement officer recommended an outcome for ${c.caseNumber}${company(c)}. Review it before deciding.`,
  }),
  advisory_published: (c) => ({
    title: truncate(`${c.severity === 'critical' ? 'Critical advisory: ' : 'Advisory: '}${c.advisoryTitle}`, 120),
    body: 'Your placement cell published a new advisory. Please read it and confirm you have seen it.',
  }),
});

/** Render a notification's title and body from its template, using only allow-listed context fields. */
function render(type, context = {}) {
  const template = TEMPLATES[type];
  if (!template) throw new Error(`Unknown notification type: ${type}`);
  const safe = Object.fromEntries(ALLOWED_FIELDS.filter((key) => context[key] != null).map((key) => [key, context[key]]));
  const { title, body } = template(safe);
  return { title: truncate(title, 120), body: truncate(body, 300) };
}

module.exports = { render, TEMPLATES, ALLOWED_FIELDS, MAX_STUDENT_MESSAGE };
