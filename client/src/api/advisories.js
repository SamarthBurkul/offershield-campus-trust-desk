import apiClient from './client.js'

const clean = (params) => Object.fromEntries(Object.entries(params).filter(([, value]) => value !== undefined && value !== ''))
const staffPath = (id, suffix = '') => `/staff/advisories/${encodeURIComponent(id)}${suffix}`

// ---- Staff
export async function listStaffAdvisories(params = {}) {
  const { data } = await apiClient.get('/staff/advisories', { params: clean(params) })
  return data
}

export async function getStaffAdvisory(id) {
  const { data } = await apiClient.get(staffPath(id))
  return data.advisory
}

export async function createAdvisory(advisory) {
  const { data } = await apiClient.post('/staff/advisories', advisory)
  return data.advisory
}

export async function updateAdvisory(id, changes) {
  const { data } = await apiClient.patch(staffPath(id), changes)
  return data.advisory
}

export async function publishAdvisory(id) {
  const { data } = await apiClient.post(staffPath(id, '/publish'), {})
  return data.advisory
}

export async function withdrawAdvisory(id, reason) {
  const { data } = await apiClient.post(staffPath(id, '/withdraw'), { reason })
  return data.advisory
}

/** Number of active students the target reaches (empty lists = everyone). */
export async function getAudienceCount({ years = [], branches = [] } = {}) {
  const { data } = await apiClient.get('/staff/advisories/audience-count', {
    params: clean({ years: years.join(','), branches: branches.join(',') }),
  })
  return data.audienceCount
}

// ---- Students
export async function listAdvisories() {
  const { data } = await apiClient.get('/advisories')
  return data.advisories
}

export async function getAdvisory(id) {
  const { data } = await apiClient.get(`/advisories/${encodeURIComponent(id)}`)
  return data.advisory
}

export async function acknowledgeAdvisory(id) {
  const { data } = await apiClient.post(`/advisories/${encodeURIComponent(id)}/ack`, {})
  return data
}
