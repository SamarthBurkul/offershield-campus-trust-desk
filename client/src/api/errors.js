/** The server's safe error message, or a generic fallback (never raw network details). */
export function errorMessage(error, fallback = 'Something went wrong. Please try again.') {
  return error?.response?.data?.error?.message || fallback
}
