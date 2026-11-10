import { createContext, useContext } from 'react'

export const AuthContext = createContext(null)

/** @returns {{ user: object | null, college: object | null, loading: boolean,
 *   login: Function, register: Function, logout: Function, refresh: Function }} */
export function useAuth() {
  const value = useContext(AuthContext)
  if (!value) throw new Error('useAuth must be used inside <AuthProvider>')
  return value
}
