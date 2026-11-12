import { useEffect, useState } from 'react'
import { subscribeSlowRequests } from '../api/slowRequests.js'

/** Non-blocking notice while any request has been pending for more than 5 seconds. */
export default function WakingServerBanner() {
  const [slow, setSlow] = useState(false)

  useEffect(() => subscribeSlowRequests(setSlow), [])

  if (!slow) return null
  return (
    <div role="status" className="bg-blue-50 px-4 py-2 text-center text-sm text-blue-900">
      Starting the server — this can take up to a minute on the free plan.
    </div>
  )
}
