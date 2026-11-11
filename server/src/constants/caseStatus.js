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

const OPEN_STATUSES = Object.freeze(['submitted', 'under_review', 'awaiting_student']);

// A decision's type is the final status it sets.
const DECISION_TYPES = CLOSED_STATUSES;

const DECISION_CHECKS = Object.freeze([
  'called_official_number',
  'matched_official_domain',
  'checked_official_careers_page',
  'mca_or_gst_lookup',
  'contacted_company_hr',
  'prior_campus_drive',
  'reviewed_student_evidence',
  'other',
]);

const DISMISS_REASONS = Object.freeze(['duplicate', 'not_an_opportunity', 'insufficient_information', 'other']);

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
  'recommendation_made',
  'linked',
]);

const SIGNAL_SEVERITIES = Object.freeze(['info', 'warning', 'high']);
const RELATED_REASONS = Object.freeze(['shared_indicator', 'similar_text', 'manual']);

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
  OPEN_STATUSES,
  DECISION_TYPES,
  DECISION_CHECKS,
  DISMISS_REASONS,
  CHANNELS,
  MONEY_PURPOSES,
  PRIORITIES,
  CASE_EVENT_TYPES,
  INDICATOR_TYPES,
  INDICATOR_SOURCES,
  EVIDENCE_LIMITS,
  SIGNAL_SEVERITIES,
  RELATED_REASONS,
};
