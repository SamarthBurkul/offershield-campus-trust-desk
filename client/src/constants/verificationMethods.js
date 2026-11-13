import { DECISION_CHECK_LABELS } from './caseStatus.js'

// Recruiter verification methods reuse the decision checks vocabulary.
export const VERIFICATION_METHOD_LABELS = DECISION_CHECK_LABELS

export const RECRUITER_STATUS_LABELS = Object.freeze({
  pending_approval: 'Pending approval',
  verified: 'Verified',
  suspended: 'Suspended',
})

export const SIGNAL_LABELS = Object.freeze({
  MATCHES_CONFIRMED_INDICATOR: 'Matches confirmed fraud indicator',
  FEE_REQUESTED: 'Fee requested',
  ALREADY_PAID: 'Already paid',
  LOOKALIKE_DOMAIN: 'Look-alike domain',
  CLAIMED_COMPANY_DOMAIN_MISMATCH: 'Company/domain mismatch',
  FREE_MAIL_SENDER: 'Free-mail sender',
  OFF_PLATFORM_ONLY: 'Messaging app only',
  URGENCY_LANGUAGE: 'Urgency language',
  DOCUMENTS_SHARED: 'Documents shared',
})

// Signal severity → badge / alert tone.
export const SIGNAL_SEVERITY_TONES = Object.freeze({ high: 'danger', warning: 'warning', info: 'neutral' })

export const RELATED_REASON_LABELS = Object.freeze({
  shared_indicator: 'Shared contact detail',
  similar_text: 'Similar message text',
  manual: 'Linked by staff',
})
