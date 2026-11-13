import { useEffect, useState } from 'react'
import { subscribeSlowRequests } from '../api/slowRequests.js'
import { Spinner } from './ui/index.js'

/** Non-blocking strip while any request has been pending for more than 5 seconds. */
export default function WakingServerBanner() {
  const [slow, setSlow] = useState(false)

  useEffect(() => subscribeSlowRequests(setSlow), [])

  if (!slow) return null
  return (
    <div role="status" className="flex items-center justify-center gap-2 bg-sky-50 px-4 py-1.5 text-center text-xs font-medium text-sky-900 ring-1 ring-inset ring-sky-200">
      <Spinner />
      Starting the server — this can take up to a minute on the free plan.
    </div>
  )
}
