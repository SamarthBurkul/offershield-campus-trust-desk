import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { acknowledgeAdvisory, getAdvisory } from '../api/advisories.js'
import { errorMessage } from '../api/errors.js'
import AdvisoryCard from '../components/AdvisoryCard.jsx'
import { ArrowLeft, Check, CheckCircle2, Undo2 } from 'lucide-react'
import { Button, EmptyState, ErrorAlert, Skeleton } from '../components/ui/index.js'
import usePageTitle from '../hooks/usePageTitle.js'

export default function AdvisoryDetailPage() {
  usePageTitle('Advisory')
  const { id } = useParams()
  const [advisory, setAdvisory] = useState(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let active = true
    getAdvisory(id)
      .then((item) => active && setAdvisory(item))
      .catch((err) => active && setError(errorMessage(err, 'This advisory is not available.')))
    return () => {
      active = false
    }
  }, [id])

  async function acknowledge() {
    setBusy(true)
    try {
      await acknowledgeAdvisory(id)
      setAdvisory((current) => ({ ...current, acknowledged: true }))
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-6">
      <Link to="/advisories" className="inline-flex items-center gap-1 text-sm font-medium text-slate-600 transition hover:text-accent-700">
        <ArrowLeft className="h-4 w-4" aria-hidden="true" /> All advisories
      </Link>
      <ErrorAlert message={error} />
      {!advisory && !error && <Skeleton rows={2} label="Loading advisory" />}
      {advisory?.status === 'withdrawn' && (
        <EmptyState icon={Undo2} as="h1" title="This advisory was withdrawn">
          Your placement cell withdrew this advisory. Check your advisories list for the latest guidance.
        </EmptyState>
      )}
      {advisory && advisory.status !== 'withdrawn' && (
        <>
          <h1 className="sr-only">{advisory.title}</h1>
          <AdvisoryCard advisory={advisory}>
            {advisory.acknowledged ? (
              <p className="inline-flex items-center gap-1.5 text-sm font-medium">
                <CheckCircle2 className="h-4 w-4" aria-hidden="true" /> You have read this
              </p>
            ) : (
              <Button icon={Check} loading={busy} onClick={acknowledge}>
                I&apos;ve read this
              </Button>
            )}
          </AdvisoryCard>
        </>
      )}
    </div>
  )
}
