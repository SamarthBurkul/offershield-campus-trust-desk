'use strict';

const { canTransition, allowedFrom, TransitionError } = require('../src/services/caseStateMachine');
const { CLOSED_STATUSES, OPEN_STATUSES } = require('../src/constants/caseStatus');

describe('case state machine', () => {
  const ALLOWED = [
    ['status_endpoint', 'submitted', 'under_review'],
    ['assignment', 'submitted', 'under_review'],
    ...OPEN_STATUSES.map((from) => ['info_request', from, 'awaiting_student']),
    ['student_reply', 'awaiting_student', 'under_review'],
    ['status_endpoint', 'awaiting_student', 'under_review'],
    ...OPEN_STATUSES.flatMap((from) => CLOSED_STATUSES.map((to) => ['decision', from, to])),
    ...CLOSED_STATUSES.map((from) => ['reopen', from, 'under_review']),
  ];

  it.each(ALLOWED)('1. allows %s: %s -> %s', (trigger, from, to) => {
    expect(canTransition(trigger, from, to)).toBe(true);
    expect(allowedFrom(trigger, to)).toContain(from);
  });

  const REJECTED = [
    ...CLOSED_STATUSES.flatMap((from) => CLOSED_STATUSES.map((to) => ['decision', from, to])),
    ...CLOSED_STATUSES.map((from) => ['info_request', from, 'awaiting_student']),
    ['status_endpoint', 'submitted', 'submitted'],
    ['status_endpoint', 'under_review', 'under_review'],
    ['assignment', 'under_review', 'under_review'],
    ['student_reply', 'under_review', 'under_review'],
    ['reopen', 'under_review', 'under_review'],
    ['decision', 'submitted', 'under_review'],
    ...CLOSED_STATUSES.map((to) => ['status_endpoint', 'under_review', to]),
    ...CLOSED_STATUSES.map((to) => ['status_endpoint', 'submitted', to]),
  ];

  it.each(REJECTED)('2. rejects %s: %s -> %s', (trigger, from, to) => {
    expect(canTransition(trigger, from, to)).toBe(false);
  });

  it('2b. the status endpoint can never produce a final status, and unknown triggers throw', () => {
    for (const final of CLOSED_STATUSES) expect(() => allowedFrom('status_endpoint', final)).toThrow(TransitionError);
    expect(() => allowedFrom('reopen', 'confirmed_fraud')).toThrow(TransitionError);
    expect(() => allowedFrom('teleport', 'under_review')).toThrow(TransitionError);
    expect(canTransition('teleport', 'submitted', 'under_review')).toBe(false);
  });
});
