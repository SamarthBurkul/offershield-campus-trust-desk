import { useCallback, useEffect, useMemo, useState } from 'react'
import * as authApi from '../api/auth.js'
import { AuthContext } from './useAuth.js'

const SIGNED_OUT = Object.freeze({ user: null, college: null, loading: false, emailVerificationRequired: false })

// The session lives in an httpOnly cookie; the client only ever knows the safe user returned by the API.
export function AuthProvider({ children }) {
  const [state, setState] = useState({ user: null, college: null, loading: true, emailVerificationRequired: false })

  const refresh = useCallback(async () => {
    try {
      const { user, college, emailVerificationRequired = false } = await authApi.getMe()
      setState({ user, college, loading: false, emailVerificationRequired })
      return user
    } catch {
      setState(SIGNED_OUT)
      return null
    }
  }, [])

  // Load the current session once on start.
  useEffect(() => {
    let active = true
    authApi
      .getMe()
      .then(({ user, college, emailVerificationRequired = false }) => active && setState({ user, college, loading: false, emailVerificationRequired }))
      .catch(() => active && setState(SIGNED_OUT))
    return () => {
      active = false
    }
  }, [])

  const login = useCallback(
    async (credentials) => {
      const { user } = await authApi.login(credentials)
      setState((current) => ({ ...current, user }))
      await refresh()
      return user
    },
    [refresh],
  )

  const register = useCallback(
    async (details) => {
      const { user } = await authApi.register(details)
      setState((current) => ({ ...current, user }))
      await refresh()
      return user
    },
    [refresh],
  )

  const logout = useCallback(async () => {
    try {
      await authApi.logout()
    } finally {
      setState(SIGNED_OUT)
    }
  }, [])

  const value = useMemo(
    () => ({ ...state, login, register, logout, refresh }),
    [state, login, register, logout, refresh],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
