import clsx from 'clsx'
import { UploadCloud, X } from 'lucide-react'
import { useId, useRef, useState } from 'react'
import { EVIDENCE_RULES } from '../../constants/caseStatus.js'
import { checkEvidenceFiles, formatFileSize } from '../../utils/fileChecks.js'
import { IconButton } from './Button.jsx'
import { fileIconFor } from './styles.js'


/**
 * Evidence picker with drag-and-drop and click-to-browse. Runs the same client-side type / size / count checks
 * as before (utils/fileChecks.js); the server re-checks every file by content. Controlled via files/onChange.
 */
export function FileDropzone({ files, onChange, alreadyUploaded = 0, label = 'Evidence files' }) {
  const id = useId()
  const inputRef = useRef(null)
  const [errors, setErrors] = useState([])
  const [dragging, setDragging] = useState(false)

  function add(list) {
    const { accepted, errors: rejected } = checkEvidenceFiles([...list], { alreadySelected: files.length, alreadyUploaded })
    setErrors(rejected)
    if (accepted.length) onChange([...files, ...accepted])
  }

  return (
    <div className="space-y-3">
      <p id={`${id}-label`} className="text-sm font-medium text-slate-700">
        {label}
      </p>
      <div
        onDragOver={(event) => {
          event.preventDefault()
          setDragging(true)
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(event) => {
          event.preventDefault()
          setDragging(false)
          add(event.dataTransfer.files)
        }}
        onClick={() => inputRef.current?.click()}
        className={clsx(
          'flex cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed px-6 py-8 text-center transition-colors duration-150',
          dragging ? 'border-accent-500 bg-accent-50' : 'border-slate-300 bg-slate-50/60 hover:border-accent-400 hover:bg-accent-50/40',
        )}
      >
        <span className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-white text-accent-600 shadow-sm ring-1 ring-slate-900/5" aria-hidden="true">
          <UploadCloud className="h-5 w-5" />
        </span>
        <p className="text-sm text-slate-700">
          <span className="font-semibold text-accent-700">Choose files</span> or drag them here
        </p>
        <p id={`${id}-hint`} className="text-xs leading-5 text-slate-500">
          PNG, JPEG or PDF, up to 3 MB each, {EVIDENCE_RULES.maxFilesPerUpload} at a time and {EVIDENCE_RULES.maxFilesPerCase} per request.
          Location and camera details are removed from images.
        </p>
        <input
          ref={inputRef}
          id={id}
          type="file"
          multiple
          accept={EVIDENCE_RULES.accept}
          aria-labelledby={`${id}-label`}
          aria-describedby={`${id}-hint`}
          onClick={(event) => event.stopPropagation()}
          onChange={(event) => {
            add(event.target.files)
            event.target.value = ''
          }}
          className="sr-only"
        />
      </div>
      {errors.length > 0 && (
        <ul role="alert" className="space-y-1 rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-900 ring-1 ring-inset ring-rose-600/20">
          {errors.map((message) => (
            <li key={message}>{message}</li>
          ))}
        </ul>
      )}
      {files.length > 0 && (
        <ul className="divide-y divide-slate-100 rounded-xl bg-white ring-1 ring-slate-900/5">
          {files.map((file, index) => {
            const Icon = fileIconFor(file.name)
            return (
              <li key={`${file.name}-${index}`} className="flex items-center gap-3 px-3 py-2">
                <Icon className="h-4 w-4 shrink-0 text-slate-500" aria-hidden="true" />
                <span className="min-w-0 flex-1 break-all text-sm text-slate-800">
                  {file.name} <span className="text-slate-500">· {formatFileSize(file.size)}</span>
                </span>
                <IconButton icon={X} size="sm" label={`Remove ${file.name}`} onClick={() => onChange(files.filter((_, i) => i !== index))} />
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
