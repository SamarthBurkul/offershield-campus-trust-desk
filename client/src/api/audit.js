import apiClient from './client.js'

/** Resolves to { entries, page, limit, total } for the TPO head's college. */
export async function listAuditEntries(params = {}) {
  const query = Object.fromEntries(Object.entries(params).filter(([, value]) => value !== undefined && value !== ''))
  const { data } = await apiClient.get('/staff/audit', { params: query })
  return data
}
