import apiClient from './client.js'

const recruiterPath = (id, suffix = '') => `/staff/registry/recruiters/${encodeURIComponent(id)}${suffix}`
const clean = (params) => Object.fromEntries(Object.entries(params).filter(([, value]) => value !== undefined && value !== ''))

/** Resolves to { recruiters, page, limit, total }. */
export async function listRecruiters(params = {}) {
  const { data } = await apiClient.get('/staff/registry/recruiters', { params: clean(params) })
  return data
}

export async function createRecruiter(recruiter) {
  const { data } = await apiClient.post('/staff/registry/recruiters', recruiter)
  return data.recruiter
}

export async function updateRecruiter(id, changes) {
  const { data } = await apiClient.patch(recruiterPath(id), changes)
  return data.recruiter
}

export async function approveRecruiter(id) {
  const { data } = await apiClient.post(recruiterPath(id, '/approve'), {})
  return data.recruiter
}

export async function renewRecruiter(id, verification) {
  const { data } = await apiClient.post(recruiterPath(id, '/renew'), verification)
  return data.recruiter
}

export async function suspendRecruiter(id, reason) {
  const { data } = await apiClient.post(recruiterPath(id, '/suspend'), { reason })
  return data.recruiter
}

/** Resolves to { indicators, page, limit, total }. */
export async function listIndicators(params = {}) {
  const { data } = await apiClient.get('/staff/registry/indicators', { params: clean(params) })
  return data
}

export async function revokeIndicator(id, reason) {
  await apiClient.post(`/staff/registry/indicators/${encodeURIComponent(id)}/revoke`, { reason })
}
