import { EVIDENCE_RULES } from '../constants/caseStatus.js'

const formatMb = (bytes) => `${(bytes / (1024 * 1024)).toFixed(1)} MB`

/**
 * Client-side pre-check of evidence files (the server re-checks every file by its content).
 * @returns {{ accepted: File[], errors: string[] }}
 */
export function checkEvidenceFiles(files, { alreadySelected = 0, alreadyUploaded = 0 } = {}) {
  const accepted = []
  const errors = []
  for (const file of files) {
    const extension = file.name.split('.').pop()?.toLowerCase()
    if (!EVIDENCE_RULES.extensions.includes(extension) || (file.type && !EVIDENCE_RULES.mimeTypes.includes(file.type))) {
      errors.push(`${file.name}: only PNG, JPEG and PDF files are allowed.`)
    } else if (file.size > EVIDENCE_RULES.maxFileBytes) {
      errors.push(`${file.name}: ${formatMb(file.size)} is over the 3 MB limit.`)
    } else if (alreadySelected + accepted.length >= EVIDENCE_RULES.maxFilesPerUpload) {
      errors.push(`${file.name}: you can attach up to ${EVIDENCE_RULES.maxFilesPerUpload} files at a time.`)
    } else if (alreadyUploaded + alreadySelected + accepted.length >= EVIDENCE_RULES.maxFilesPerCase) {
      errors.push(`${file.name}: a request can have at most ${EVIDENCE_RULES.maxFilesPerCase} files.`)
    } else {
      accepted.push(file)
    }
  }
  return { accepted, errors }
}

export function formatFileSize(bytes) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return formatMb(bytes)
}
