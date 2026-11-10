'use strict';

const CASE_STATUSES = Object.freeze([
  'submitted',
  'under_review',
  'awaiting_student',
  'confirmed_fraud',
  'verified_genuine',
  'inconclusive',
  'dismissed',
]);

// A closed case accepts no replies or evidence from the student.
const CLOSED_STATUSES = Object.freeze(['confirmed_fraud', 'verified_genuine', 'inconclusive', 'dismissed']);

const isClosedStatus = (status) => CLOSED_STATUSES.includes(status);

const CHANNELS = Object.freeze([
  'whatsapp',
  'telegram',
  'email',
  'linkedin',
  'instagram',
  'job_portal',
  'sms',
  'phone_call',
  'other',
]);

const MONEY_PURPOSES = Object.freeze([
  'registration',
  'training',
  'security_deposit',
  'document_verification',
  'equipment',
  'other',
]);

const PRIORITIES = Object.freeze(['normal', 'high']);

const CASE_EVENT_TYPES = Object.freeze([
  'created',
  'student_message',
  'evidence_added',
  'status_changed',
  'info_requested',
  'staff_message',
  'assigned',
  'decision_recorded',
  'reopened',
]);

const INDICATOR_TYPES = Object.freeze(['email', 'domain', 'phone', 'upi', 'url']);
const INDICATOR_SOURCES = Object.freeze(['student_entered', 'extracted']);

const EVIDENCE_LIMITS = Object.freeze({
  maxFileBytes: 3 * 1024 * 1024,
  maxFilesPerRequest: 5,
  maxFilesPerCase: 10,
});

module.exports = {
  CASE_STATUSES,
  CLOSED_STATUSES,
  isClosedStatus,
  CHANNELS,
  MONEY_PURPOSES,
  PRIORITIES,
  CASE_EVENT_TYPES,
  INDICATOR_TYPES,
  INDICATOR_SOURCES,
  EVIDENCE_LIMITS,
};
