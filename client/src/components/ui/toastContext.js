import { createContext, useContext } from 'react'

export const ToastContext = createContext(null)
const NOOP = Object.freeze({ show: () => {}, success: () => {}, error: () => {} })

/** `{ success(message), error(message), show({ tone, message }) }`; a no-op outside the provider. */
export function useToast() {
  return useContext(ToastContext) ?? NOOP
}
