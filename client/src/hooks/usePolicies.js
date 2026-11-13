import { useEffect, useState } from 'react'
import { getPolicies } from '../api/policies.js'
import { DEFAULT_RETENTION_MONTHS, POLICIES_VERSION } from '../constants/policies.js'

/**
 * Policy facts and sign-in options from the server (retention period, support contact, Google sign-in,
 * self-service email), with safe defaults while loading: Google and email count as off until confirmed.
 */
const DEFAULTS = Object.freeze({
  version: POLICIES_VERSION,
  retentionMonths: DEFAULT_RETENTION_MONTHS,
  supportEmail: null,
  googleEnabled: false,
  emailEnabled: false,
})

export default function usePolicies() {
  const [policies, setPolicies] = useState(DEFAULTS)

  useEffect(() => {
    let active = true
    Promise.resolve()
      .then(() => getPolicies())
      .then((value) => active && value && setPolicies({ ...DEFAULTS, ...value }))
      .catch(() => {})
    return () => {
      active = false
    }
  }, [])

  return policies
}
