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

export const SIGNAL_SEVERITY_CLASSES = Object.freeze({
  high: 'border-red-300 bg-red-50 text-red-900',
  warning: 'border-amber-300 bg-amber-50 text-amber-900',
  info: 'border-slate-300 bg-slate-50 text-slate-800',
})

export const RELATED_REASON_LABELS = Object.freeze({
  shared_indicator: 'Shared contact detail',
  similar_text: 'Similar message text',
  manual: 'Linked by staff',
})
