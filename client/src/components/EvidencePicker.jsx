import { useId, useState } from 'react'
import { EVIDENCE_RULES } from '../constants/caseStatus.js'
import { checkEvidenceFiles, formatFileSize } from '../utils/fileChecks.js'
import { Button } from './ui.jsx'

/** File picker for evidence with client-side type/size/count checks. Controlled via files/onChange. */
export default function EvidencePicker({ files, onChange, alreadyUploaded = 0, label = 'Evidence files' }) {
  const id = useId()
  const [errors, setErrors] = useState([])

  function handleSelect(event) {
    const { accepted, errors: rejected } = checkEvidenceFiles([...event.target.files], {
      alreadySelected: files.length,
      alreadyUploaded,
    })
    setErrors(rejected)
    if (accepted.length) onChange([...files, ...accepted])
    event.target.value = ''
  }

  return (
    <div className="space-y-2">
      <label htmlFor={id} className="block text-sm font-medium text-slate-700">
        {label}
      </label>
      <input
        id={id}
        type="file"
        multiple
        accept={EVIDENCE_RULES.accept}
        onChange={handleSelect}
        className="block w-full text-sm text-slate-700 file:mr-3 file:rounded-md file:border-0 file:bg-slate-100 file:px-3 file:py-2 file:text-sm file:font-medium"
      />
      <p className="text-xs text-slate-500">
        PNG, JPEG or PDF, up to 3 MB each, {EVIDENCE_RULES.maxFilesPerUpload} at a time and{' '}
        {EVIDENCE_RULES.maxFilesPerCase} per request. Location and camera details are removed from images.
      </p>
      {errors.length > 0 && (
        <ul role="alert" className="space-y-1 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          {errors.map((message) => (
            <li key={message}>{message}</li>
          ))}
        </ul>
      )}
      {files.length > 0 && (
        <ul className="space-y-1 text-sm">
          {files.map((file, index) => (
            <li key={`${file.name}-${index}`} className="flex items-center justify-between gap-2">
              <span className="break-all text-slate-800">
                {file.name} <span className="text-slate-500">· {formatFileSize(file.size)}</span>
              </span>
              <Button variant="secondary" onClick={() => onChange(files.filter((_, i) => i !== index))}>
                Remove
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
