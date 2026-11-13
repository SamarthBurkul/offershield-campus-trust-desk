import apiClient from './client.js'

export async function getMe() {
  const { data } = await apiClient.get('/auth/me')
  return data
}

export async function login(credentials) {
  const { data } = await apiClient.post('/auth/login', credentials)
  return data
}

export async function register(details) {
  const { data } = await apiClient.post('/auth/register', details)
  return data
}

export async function logout() {
  await apiClient.post('/auth/logout')
}

export async function changePassword(passwords) {
  const { data } = await apiClient.post('/auth/change-password', passwords)
  return data
}

/** Confirm the 6-digit code emailed at registration. Resolves to the updated safe user. */
export async function verifyEmail(code) {
  const { data } = await apiClient.post('/auth/verify-email', { code })
  return data.user
}

/** Resolves to { sent, retryAfterSeconds }. 429 RESEND_TOO_SOON / RESEND_LIMIT carry details.retryAfterSeconds. */
export async function resendVerification() {
  const { data } = await apiClient.post('/auth/resend-verification')
  return data
}

/** Always resolves with the same generic message (202), whether or not the address has an account. */
export async function forgotPassword(email) {
  const { data } = await apiClient.post('/auth/forgot-password', { email })
  return data
}

export async function resetPassword(token, newPassword) {
  const { data } = await apiClient.post('/auth/reset-password', { token, newPassword })
  return data
}

/** The Google account waiting to finish registration: { email, name }. */
export async function getGooglePending() {
  const { data } = await apiClient.get('/auth/google/pending')
  return data
}

export async function completeGoogleRegistration(details) {
  const { data } = await apiClient.post('/auth/google/complete', details)
  return data
}
