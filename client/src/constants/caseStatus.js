// Shared case vocabulary for student (Phase 3) and staff (Phase 4) screens.

export const CLOSED_STATUSES = Object.freeze(['confirmed_fraud', 'verified_genuine', 'inconclusive', 'dismissed'])

export const isClosedStatus = (status) => CLOSED_STATUSES.includes(status)

// What students see. "Confirmed fraud" and "Verified" only ever come from a placement-cell decision.
export const STUDENT_STATUS_LABELS = Object.freeze({
  submitted: 'Received',
  under_review: 'Being reviewed',
  awaiting_student: 'Needs your reply',
  confirmed_fraud: 'Confirmed fraud',
  verified_genuine: 'Verified by placement cell',
  inconclusive: 'Could not verify',
  dismissed: 'Closed',
})

export const STATUS_BADGE_CLASSES = Object.freeze({
  submitted: 'bg-slate-100 text-slate-800',
  under_review: 'bg-blue-100 text-blue-800',
  awaiting_student: 'bg-amber-100 text-amber-900',
  confirmed_fraud: 'bg-red-100 text-red-800',
  verified_genuine: 'bg-emerald-100 text-emerald-800',
  inconclusive: 'bg-violet-100 text-violet-800',
  dismissed: 'bg-slate-200 text-slate-700',
})

export const CHANNEL_LABELS = Object.freeze({
  whatsapp: 'WhatsApp',
  telegram: 'Telegram',
  email: 'Email',
  linkedin: 'LinkedIn',
  instagram: 'Instagram',
  job_portal: 'Job portal',
  sms: 'SMS',
  phone_call: 'Phone call',
  other: 'Other',
})

export const MONEY_PURPOSE_LABELS = Object.freeze({
  registration: 'Registration fee',
  training: 'Training fee',
  security_deposit: 'Security deposit',
  document_verification: 'Document verification',
  equipment: 'Equipment / laptop',
  other: 'Other',
})

export const INDICATOR_TYPE_LABELS = Object.freeze({
  domain: 'Websites / domains',
  url: 'Links',
  email: 'Email addresses',
  phone: 'Phone numbers',
  upi: 'UPI IDs',
})

export const EVIDENCE_RULES = Object.freeze({
  accept: '.png,.jpg,.jpeg,.pdf',
  mimeTypes: ['image/png', 'image/jpeg', 'application/pdf'],
  extensions: ['png', 'jpg', 'jpeg', 'pdf'],
  maxFileBytes: 3 * 1024 * 1024,
  maxFilesPerUpload: 5,
  maxFilesPerCase: 10,
})

// Staff desk vocabulary (Phase 4).
export const OPEN_STATUSES = Object.freeze(['submitted', 'under_review', 'awaiting_student'])

export const STAFF_STATUS_LABELS = Object.freeze({
  submitted: 'Submitted',
  under_review: 'Under review',
  awaiting_student: 'Awaiting student',
  confirmed_fraud: 'Confirmed fraud',
  verified_genuine: 'Verified genuine',
  inconclusive: 'Inconclusive',
  dismissed: 'Dismissed',
})

export const DECISION_TYPE_LABELS = Object.freeze({
  confirmed_fraud: 'Confirmed fraud',
  verified_genuine: 'Verified genuine',
  inconclusive: 'Inconclusive',
  dismissed: 'Dismissed',
})

// Plain-language outcome shown to students on a closed request.
export const STUDENT_OUTCOME_COPY = Object.freeze({
  confirmed_fraud: 'Your placement cell confirmed that this offer is fraudulent.',
  verified_genuine: 'Your placement cell verified that this offer is genuine.',
  inconclusive: 'Your placement cell could not verify this offer either way.',
  dismissed: 'Your placement cell closed this request.',
})

export const DECISION_CHECK_LABELS = Object.freeze({
  called_official_number: 'Called the official company number',
  matched_official_domain: 'Matched the official company domain',
  checked_official_careers_page: 'Checked the official careers page',
  mca_or_gst_lookup: 'MCA or GST lookup',
  contacted_company_hr: 'Contacted company HR',
  prior_campus_drive: 'Company held a prior campus drive',
  reviewed_student_evidence: 'Reviewed the student’s evidence',
  other: 'Other',
})

export const DISMISS_REASON_LABELS = Object.freeze({
  duplicate: 'Duplicate of another case',
  not_an_opportunity: 'Not a job or internship offer',
  insufficient_information: 'Insufficient information',
  other: 'Other',
})

export const PRIORITY_LABELS = Object.freeze({ normal: 'Normal', high: 'High' })

export const QUEUE_TABS = Object.freeze([
  { value: 'open', label: 'Open' },
  { value: 'submitted', label: 'Submitted' },
  { value: 'under_review', label: 'Under review' },
  { value: 'awaiting_student', label: 'Awaiting student' },
  { value: 'closed', label: 'Closed' },
])
