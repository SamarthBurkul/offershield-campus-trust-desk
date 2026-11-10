import { useState } from 'react'
import { getEvidenceLink } from '../api/cases.js'
import { errorMessage } from '../api/errors.js'
import { formatFileSize } from '../utils/fileChecks.js'
import { Button, ErrorAlert } from './ui.jsx'

export default function EvidenceList({ caseId, evidence }) {
  const [error, setError] = useState('')
  const [openingId, setOpeningId] = useState(null)

  async function view(item) {
    setError('')
    setOpeningId(item.id)
    // Open the tab synchronously (popup blockers), then point it at the short-lived link.
    const tab = window.open('', '_blank')
    try {
      const { url } = await getEvidenceLink(caseId, item.id)
      if (tab) {
        tab.opener = null
        tab.location.href = url
      } else {
        window.location.assign(url)
      }
    } catch (err) {
      tab?.close()
      setError(errorMessage(err, 'Could not open this file. Please try again.'))
    } finally {
      setOpeningId(null)
    }
  }

  if (!evidence?.length) return <p className="text-sm text-slate-600">No evidence attached yet.</p>

  return (
    <div className="space-y-2">
      <ErrorAlert message={error} />
      <ul className="divide-y divide-slate-100">
        {evidence.map((item) => (
          <li key={item.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
            <span className="break-all text-slate-800">
              {item.originalName} <span className="text-slate-500">· {formatFileSize(item.size)}</span>
            </span>
            <Button variant="secondary" disabled={openingId === item.id} onClick={() => view(item)}>
              {openingId === item.id ? 'Opening…' : 'View'}
            </Button>
          </li>
        ))}
      </ul>
    </div>
  )
}
