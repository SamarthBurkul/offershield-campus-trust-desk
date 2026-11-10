import apiClient from './client.js'

const casePath = (id, suffix = '') => `/staff/cases/${encodeURIComponent(id)}${suffix}`

/** Resolves to { cases, page, limit, total }. Empty params are dropped. */
export async function listStaffCases(params = {}) {
  const query = Object.fromEntries(Object.entries(params).filter(([, value]) => value !== undefined && value !== ''))
  const { data } = await apiClient.get('/staff/cases', { params: query })
  return data
}

export async function getCaseCounts() {
  const { data } = await apiClient.get('/staff/cases/counts')
  return data.counts
}

// Every mutation resolves to the refreshed staff case view.
export async function getStaffCase(id) {
  const { data } = await apiClient.get(casePath(id))
  return data.case
}

export async function assignCase(id, assigneeId) {
  const { data } = await apiClient.patch(casePath(id, '/assign'), { assigneeId })
  return data.case
}

export async function setCaseStatus(id, status) {
  const { data } = await apiClient.patch(casePath(id, '/status'), { status })
  return data.case
}

export async function requestInfo(id, message) {
  const { data } = await apiClient.post(casePath(id, '/info-request'), { message })
  return data.case
}

export async function sendStaffMessage(id, body) {
  const { data } = await apiClient.post(casePath(id, '/messages'), { body })
  return data.case
}

export async function addNote(id, body) {
  const { data } = await apiClient.post(casePath(id, '/notes'), { body })
  return data.case
}

export async function recommend(id, recommendation) {
  const { data } = await apiClient.post(casePath(id, '/recommendation'), recommendation)
  return data.case
}

export async function recordDecision(id, decision) {
  const { data } = await apiClient.post(casePath(id, '/decision'), decision)
  return data.case
}

export async function reopenCase(id, reason) {
  const { data } = await apiClient.post(casePath(id, '/reopen'), { reason })
  return data.case
}
