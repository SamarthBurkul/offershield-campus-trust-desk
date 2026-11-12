// Tracks requests that have been pending for a while (the free hosting plan sleeps when idle and can
// take up to a minute to wake). The waking-server banner subscribes to this; nothing here blocks a request.
export const SLOW_REQUEST_MS = 5000

let slowCount = 0
const listeners = new Set()

function emit() {
  for (const listener of listeners) listener(slowCount > 0)
}

/** Subscribe to "is any request slow right now?". Returns an unsubscribe function. */
export function subscribeSlowRequests(listener) {
  listeners.add(listener)
  listener(slowCount > 0)
  return () => listeners.delete(listener)
}

/** Call when a request starts; call the returned function exactly once when it settles. */
export function trackRequest() {
  let slow = false
  const timer = setTimeout(() => {
    slow = true
    slowCount += 1
    emit()
  }, SLOW_REQUEST_MS)
  return function settle() {
    clearTimeout(timer)
    if (slow) {
      slowCount -= 1
      emit()
    }
  }
}
