import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { listAdvisories } from '../api/advisories.js'
import { errorMessage } from '../api/errors.js'
import AdvisoryCard from '../components/AdvisoryCard.jsx'
import { ArrowRight, CheckCircle2, Circle, Megaphone } from 'lucide-react'
import { EmptyState, ErrorAlert, PageHeader, Skeleton } from '../components/ui/index.js'
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
      <PageHeader title="Advisories" description="Warnings your placement cell published from confirmed findings." />
      <ErrorAlert message={error} />
      {!advisories && !error && <Skeleton rows={3} label="Loading advisories" />}
      {advisories?.length === 0 && <EmptyState icon={Megaphone} title="No advisories right now">Your placement cell will post warnings here when it confirms a scam.</EmptyState>}
      <div className="space-y-4">
        {advisories?.map((advisory) => (
          <AdvisoryCard key={advisory.id} advisory={advisory}>
            <div className="flex flex-wrap items-center gap-3 text-sm">
              {advisory.acknowledged ? (
                <span className="inline-flex items-center gap-1.5 font-medium">
                  <CheckCircle2 className="h-4 w-4" aria-hidden="true" /> You have read this
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 font-medium">
                  <Circle className="h-4 w-4" aria-hidden="true" /> Not yet acknowledged
                </span>
              )}
              <Link to={`/advisories/${advisory.id}`} className="inline-flex items-center gap-1 font-medium underline underline-offset-2">
                Open <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
              </Link>
            </div>
          </AdvisoryCard>
        ))}
      </div>
    </div>
  )
}
