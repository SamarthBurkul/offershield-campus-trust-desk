import { useState } from 'react'
import { getEvidenceLink } from '../api/cases.js'
import { errorMessage } from '../api/errors.js'
import { formatFileSize } from '../utils/fileChecks.js'
import { ExternalLink } from 'lucide-react'
import { Button, ErrorAlert, fileIconFor } from './ui/index.js'

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
      <ul className="divide-y divide-slate-100 rounded-xl ring-1 ring-slate-900/5">
        {evidence.map((item) => {
          const Icon = fileIconFor(item.originalName)
          return (
            <li key={item.id} className="flex items-center gap-3 px-3 py-2.5 text-sm">
              <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-600" aria-hidden="true">
                <Icon className="h-4 w-4" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block break-all font-medium text-slate-800">{item.originalName}</span>
                <span className="block text-xs text-slate-500">{formatFileSize(item.size)}</span>
              </span>
              <Button variant="secondary" size="sm" iconRight={ExternalLink} loading={openingId === item.id} onClick={() => view(item)}>
                {openingId === item.id ? 'Opening…' : 'View'}
              </Button>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
