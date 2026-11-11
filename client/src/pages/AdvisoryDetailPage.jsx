import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { acknowledgeAdvisory, getAdvisory } from '../api/advisories.js'
import { errorMessage } from '../api/errors.js'
import AdvisoryCard from '../components/AdvisoryCard.jsx'
import Skeleton from '../components/Skeleton.jsx'
import { Button, ErrorAlert } from '../components/ui.jsx'
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
      <Link to="/advisories" className="text-sm font-medium text-blue-700 hover:underline">
        ← All advisories
      </Link>
      <ErrorAlert message={error} />
      {!advisory && !error && <Skeleton rows={2} label="Loading advisory" />}
      {advisory?.status === 'withdrawn' && (
        <section className="space-y-2 rounded-lg border border-slate-300 bg-slate-50 p-5">
          <h1 className="text-xl font-semibold text-slate-900">This advisory was withdrawn</h1>
          <p className="text-sm text-slate-700">Your placement cell withdrew this advisory. Check your advisories list for the latest guidance.</p>
        </section>
      )}
      {advisory && advisory.status !== 'withdrawn' && (
        <>
          <h1 className="sr-only">{advisory.title}</h1>
          <AdvisoryCard advisory={advisory}>
            {advisory.acknowledged ? (
              <p className="text-sm font-medium">✓ You have read this</p>
            ) : (
              <Button disabled={busy} onClick={acknowledge}>
                I&apos;ve read this
              </Button>
            )}
          </AdvisoryCard>
        </>
      )}
    </div>
  )
}
