'use strict';

const { idOf } = require('./safeUser');
const { OPEN_STATUSES } = require('../constants/caseStatus');

const iso = (date) => (date ? new Date(date).toISOString() : null);

function baseCaseFields(doc) {
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
    lastActivityAt: iso(doc.lastActivityAt),
    createdAt: iso(doc.createdAt),
    updatedAt: iso(doc.updatedAt),
  };
}

/**
 * The single serializer for what a student may see of a case. Built from an explicit allow-list:
 * never assigneeId, priority, signals, linkedCaseIds, recommendation, decisionHistory, or the
 * decision's basis/checks/indicators/decider. The decision is only { type, decidedAt, message }.
 */
function toStudentCaseView(doc) {
  return {
    ...baseCaseFields(doc),
    decision: doc.decision
      ? { type: doc.decision.type, decidedAt: iso(doc.decision.decidedAt), message: doc.decision.studentMessage ?? null }
      : null,
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

/**
 * Caller must pass only events with visibleToStudent === true. Metadata (which can hold staff-only
 * details such as a reopen reason) and staff identities are never included.
 */
function toStudentEventView(event) {
  return {
    id: idOf(event._id),
    type: event.type,
    actor: event.actorRole === 'student' ? 'student' : event.actorRole ? 'placement_cell' : 'system',
    body: event.body ?? null,
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

// ---------------------------------------------------------------------------------------------
// Staff views. Only ever returned by /staff routes (placement_officer, tpo_head of the same college).

const personRef = (usersById, id) => {
  if (!id) return null;
  const user = usersById.get(String(id));
  return { id: String(id), name: user?.name ?? null, role: user?.role ?? null };
};

function decisionView(decision, usersById) {
  if (!decision) return null;
  return {
    type: decision.type,
    basis: decision.basis,
    checks: [...(decision.checks ?? [])],
    studentMessage: decision.studentMessage ?? null,
    confirmedIndicators: (decision.confirmedIndicators ?? []).map(({ type, value }) => ({ type, value })),
    verifiedDomains: [...(decision.verifiedDomains ?? [])],
    dismissReason: decision.dismissReason ?? null,
    duplicateOfCaseId: idOf(decision.duplicateOfCaseId),
    decidedBy: personRef(usersById, decision.decidedBy),
    decidedAt: iso(decision.decidedAt),
  };
}

function isStale(doc, staleDays, now = Date.now()) {
  return OPEN_STATUSES.includes(doc.status) && new Date(doc.lastActivityAt).getTime() < now - staleDays * 86_400_000;
}

/** One row of the staff queue. */
function toStaffCaseListItem(doc, { usersById, evidenceCount, staleDays }) {
  const student = usersById.get(String(doc.studentId));
  const assignee = doc.assigneeId ? usersById.get(String(doc.assigneeId)) : null;
  return {
    id: idOf(doc._id),
    caseNumber: doc.caseNumber,
    claimedCompany: doc.claimedCompany,
    roleTitle: doc.roleTitle ?? null,
    channel: doc.channel,
    status: doc.status,
    priority: doc.priority,
    student: student ? { name: student.name, year: student.year ?? null, branch: student.branch ?? null } : null,
    assignee: doc.assigneeId ? { id: String(doc.assigneeId), name: assignee?.name ?? null } : null,
    evidenceCount,
    lastActivityAt: iso(doc.lastActivityAt),
    createdAt: iso(doc.createdAt),
    isStale: isStale(doc, staleDays),
  };
}

function toStaffEventView(event, usersById) {
  return {
    id: idOf(event._id),
    type: event.type,
    actor: personRef(usersById, event.actorId) ?? { id: null, name: null, role: event.actorRole ?? null },
    body: event.body ?? null,
    visibleToStudent: event.visibleToStudent,
    metadata: event.metadata ?? {},
    createdAt: iso(event.createdAt),
  };
}

function toNoteView(note, usersById) {
  return {
    id: idOf(note._id),
    author: personRef(usersById, note.authorId),
    body: note.body,
    createdAt: iso(note.createdAt),
  };
}

/** Staff evidence view: adds hash and stripping flag; still never the GridFS id. */
function toStaffEvidenceView(evidence) {
  return {
    ...toStudentEvidenceView(evidence),
    sha256: evidence.sha256,
    metadataStripped: evidence.metadataStripped,
  };
}

/** Full staff view of a case, including internal events, notes, recommendation and decisions. */
function toStaffCaseView(doc, { usersById, events, notes, evidence, staleDays }) {
  const student = usersById.get(String(doc.studentId));
  return {
    ...baseCaseFields(doc),
    priority: doc.priority,
    isStale: isStale(doc, staleDays),
    student: student
      ? { id: String(student._id), name: student.name, email: student.email, year: student.year ?? null, branch: student.branch ?? null }
      : null,
    assignee: personRef(usersById, doc.assigneeId),
    recommendation: doc.recommendation
      ? { type: doc.recommendation.type, basis: doc.recommendation.basis, by: personRef(usersById, doc.recommendation.by), at: iso(doc.recommendation.at) }
      : null,
    decision: decisionView(doc.decision, usersById),
    decisionHistory: (doc.decisionHistory ?? []).map((entry) => ({
      ...decisionView(entry, usersById),
      reopenedBy: personRef(usersById, entry.reopenedBy),
      reopenedAt: iso(entry.reopenedAt),
      reopenReason: entry.reopenReason,
    })),
    signals: [...(doc.signals ?? [])],
    linkedCaseIds: (doc.linkedCaseIds ?? []).map(String),
    events: events.map((event) => toStaffEventView(event, usersById)),
    notes: notes.map((note) => toNoteView(note, usersById)),
    evidence: evidence.map(toStaffEvidenceView),
  };
}

module.exports = {
  toStudentCaseView,
  toStudentCaseSummary,
  toStudentEventView,
  toStudentEvidenceView,
  toStaffCaseListItem,
  toStaffCaseView,
  toStaffEventView,
  toNoteView,
  isStale,
};
