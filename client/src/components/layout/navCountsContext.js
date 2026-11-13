import { createContext, useContext } from 'react'

export const NavCountsContext = createContext(null)
const FALLBACK = Object.freeze({ counts: {}, publish: () => {} })

/** Sidebar badge counts published by pages that already fetched them. */
export function useNavCounts() {
  return useContext(NavCountsContext) ?? FALLBACK
}
