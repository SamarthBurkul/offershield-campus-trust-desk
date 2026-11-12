import apiClient from './client.js'

/** Resolves to { version, retentionMonths, supportEmail }. */
export async function getPolicies() {
  const { data } = await apiClient.get('/policies')
  return data
}
