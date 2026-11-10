'use strict';

/**
 * Case status state machine (pure). Each trigger lists the statuses it may start from and the
 * statuses it may produce. Services apply a transition with one atomic conditional update whose
 * filter is `status: { $in: allowedFrom(trigger, to) }`.
 */
const { OPEN_STATUSES, CLOSED_STATUSES } = require('../constants/caseStatus');

const TRIGGERS = Object.freeze({
  // PATCH /staff/cases/:id/status — never a final status.
  status_endpoint: { from: ['submitted', 'awaiting_student'], to: ['under_review'] },
  // Assigning a submitted case starts the review.
  assignment: { from: ['submitted'], to: ['under_review'] },
  info_request: { from: [...OPEN_STATUSES], to: ['awaiting_student'] },
  student_reply: { from: ['awaiting_student'], to: ['under_review'] },
  // Final statuses can only be set here.
  decision: { from: [...OPEN_STATUSES], to: [...CLOSED_STATUSES] },
  // The only way out of a final status (TPO head only).
  reopen: { from: [...CLOSED_STATUSES], to: ['under_review'] },
});

class TransitionError extends Error {
  constructor(message) {
    super(message);
    this.name = 'TransitionError';
  }
}

function definition(trigger) {
  const def = TRIGGERS[trigger];
  if (!def) throw new TransitionError(`Unknown trigger: ${trigger}`);
  return def;
}

/** True when `trigger` may move a case from `from` to `to`. */
function canTransition(trigger, from, to) {
  const def = TRIGGERS[trigger];
  return Boolean(def && def.from.includes(from) && def.to.includes(to));
}

/**
 * Statuses a case must currently have for `trigger` to move it to `to`.
 * Throws TransitionError if the trigger can never produce `to` (e.g. the status endpoint and a final status).
 */
function allowedFrom(trigger, to) {
  const def = definition(trigger);
  if (!def.to.includes(to)) throw new TransitionError(`${trigger} cannot set status ${to}`);
  return [...def.from];
}

module.exports = { TRIGGERS, canTransition, allowedFrom, TransitionError };
