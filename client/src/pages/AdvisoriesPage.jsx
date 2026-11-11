import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { listAdvisories } from '../api/advisories.js'
import { errorMessage } from '../api/errors.js'
import AdvisoryCard from '../components/AdvisoryCard.jsx'
import EmptyState from '../components/EmptyState.jsx'
import Skeleton from '../components/Skeleton.jsx'
import { ErrorAlert } from '../components/ui.jsx'
import usePageTitle from '../hooks/usePageTitle.js'

export default function AdvisoriesPage() {
  usePageTitle('Advisories')
  const [advisories, setAdvisories] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    listAdvisories()
      .then((items) => active && setAdvisories(items))
      .catch((err) => active && setError(errorMessage(err, 'Could not load advisories.')))
    return () => {
      active = false
    }
  }, [])

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-slate-900">Advisories</h1>
      <p className="text-sm text-slate-600">Warnings your placement cell published from confirmed findings.</p>
      <ErrorAlert message={error} />
      {!advisories && !error && <Skeleton rows={3} label="Loading advisories" />}
      {advisories?.length === 0 && <EmptyState title="No advisories right now">Your placement cell will post warnings here when it confirms a scam.</EmptyState>}
      <div className="space-y-4">
        {advisories?.map((advisory) => (
          <AdvisoryCard key={advisory.id} advisory={advisory}>
            <div className="flex flex-wrap items-center gap-3 text-sm">
              {advisory.acknowledged ? <span className="font-medium">✓ You have read this</span> : <span className="font-medium">Not yet acknowledged</span>}
              <Link to={`/advisories/${advisory.id}`} className="font-medium underline">
                Open
              </Link>
            </div>
          </AdvisoryCard>
        ))}
      </div>
    </div>
  )
}
