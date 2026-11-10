'use strict';

const { idOf } = require('./safeUser');

const iso = (date) => (date ? new Date(date).toISOString() : null);

/**
 * The single serializer for what a student may see of a case. Built from an explicit allow-list:
 * never assigneeId, priority, signals, linkedCaseIds or who decided.
 */
function toStudentCaseView(doc) {
  return {
    id: idOf(doc._id),
    caseNumber: doc.caseNumber,
    claimedCompany: doc.claimedCompany,
    roleTitle: doc.roleTitle ?? null,
    channel: doc.channel,
    receivedAt: iso(doc.receivedAt),
    messageText: doc.messageText,
    links: [...(doc.links ?? [])],
    contacts: {
      emails: [...(doc.contacts?.emails ?? [])],
      phones: [...(doc.contacts?.phones ?? [])],
      upiIds: [...(doc.contacts?.upiIds ?? [])],
    },
    moneyRequested: {
      requested: Boolean(doc.moneyRequested?.requested),
      amount: doc.moneyRequested?.amount ?? null,
      purpose: doc.moneyRequested?.purpose ?? null,
    },
    paidAlready: Boolean(doc.paidAlready),
    documentsShared: Boolean(doc.documentsShared),
    studentNote: doc.studentNote ?? null,
    status: doc.status,
    indicators: (doc.indicators ?? []).map(({ type, value, source }) => ({ type, value, source })),
    decision: doc.decision ? { type: doc.decision.type, basis: doc.decision.basis, decidedAt: iso(doc.decision.decidedAt) } : null,
    lastActivityAt: iso(doc.lastActivityAt),
    createdAt: iso(doc.createdAt),
    updatedAt: iso(doc.updatedAt),
  };
}

function toStudentCaseSummary(doc) {
  return {
    id: idOf(doc._id),
    caseNumber: doc.caseNumber,
    claimedCompany: doc.claimedCompany,
    channel: doc.channel,
    status: doc.status,
    receivedAt: iso(doc.receivedAt),
    createdAt: iso(doc.createdAt),
    lastActivityAt: iso(doc.lastActivityAt),
  };
}

// Only these metadata keys are shown on the student timeline.
const STUDENT_EVENT_METADATA = { status_changed: ['from', 'to'], evidence_added: ['count', 'names'] };

/** Caller must pass only events with visibleToStudent === true. Staff identities are not exposed. */
function toStudentEventView(event) {
  const allowed = STUDENT_EVENT_METADATA[event.type] ?? [];
  const metadata = Object.fromEntries(allowed.filter((key) => event.metadata?.[key] !== undefined).map((key) => [key, event.metadata[key]]));
  return {
    id: idOf(event._id),
    type: event.type,
    actor: event.actorRole === 'student' ? 'student' : event.actorRole ? 'placement_cell' : 'system',
    body: event.body ?? null,
    metadata,
    createdAt: iso(event.createdAt),
  };
}

/** Never the GridFS id or the hash. */
function toStudentEvidenceView(evidence) {
  return {
    id: idOf(evidence._id),
    originalName: evidence.originalName,
    mime: evidence.mime,
    size: evidence.size,
    createdAt: iso(evidence.createdAt),
  };
}

module.exports = { toStudentCaseView, toStudentCaseSummary, toStudentEventView, toStudentEvidenceView };
