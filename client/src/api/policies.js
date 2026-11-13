import apiClient from './client.js'

/** Resolves to { version, retentionMonths, supportEmail, googleEnabled, emailEnabled }. */
export async function getPolicies() {
  const { data } = await apiClient.get('/policies')
  return data
}
