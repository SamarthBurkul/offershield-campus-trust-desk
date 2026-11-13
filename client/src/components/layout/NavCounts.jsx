import { useCallback, useMemo, useState } from 'react'
import { NavCountsContext } from './navCountsContext.js'


/**
 * Sidebar count badges (open cases, pending students). Pages publish counts they have ALREADY fetched;
 * the shell never makes extra requests for them.
 */
export function NavCountsProvider({ children }) {
  const [counts, setCounts] = useState({})
  const publish = useCallback((patch) => setCounts((current) => ({ ...current, ...patch })), [])
  const value = useMemo(() => ({ counts, publish }), [counts, publish])
  return <NavCountsContext.Provider value={value}>{children}</NavCountsContext.Provider>
}
