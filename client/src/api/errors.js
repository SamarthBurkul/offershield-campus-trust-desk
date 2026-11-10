/** The server's safe error message, or a generic fallback (never raw network details). */
export function errorMessage(error, fallback = 'Something went wrong. Please try again.') {
  return error?.response?.data?.error?.message || fallback
}

/** Staff desk errors: a 409 means another user changed the case first. */
export function deskErrorMessage(error, fallback) {
  if (error?.response?.status === 409) {
    const code = error.response.data?.error?.code
    if (code === 'CASE_CLOSED') return 'This case is closed, so this action is no longer possible. Refresh to see the latest version.'
    return 'This case was updated by someone else — refresh to see the latest version and try again.'
  }
  return errorMessage(error, fallback)
}
