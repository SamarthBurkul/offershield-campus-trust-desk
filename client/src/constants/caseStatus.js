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
