import { useEffect, useState } from 'react'
import { getPolicies } from '../api/policies.js'
import { DEFAULT_RETENTION_MONTHS, POLICIES_VERSION } from '../constants/policies.js'

/** Policy facts from the server (retention period, support contact), with safe defaults while loading. */
export default function usePolicies() {
  const [policies, setPolicies] = useState({ version: POLICIES_VERSION, retentionMonths: DEFAULT_RETENTION_MONTHS, supportEmail: null })

  useEffect(() => {
    let active = true
    getPolicies()
      .then((value) => active && setPolicies(value))
      .catch(() => {})
    return () => {
      active = false
    }
  }, [])

  return policies
}
