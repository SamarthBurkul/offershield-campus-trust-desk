import apiClient from './client.js'

export async function listStaffMembers() {
  const { data } = await apiClient.get('/staff/members')
  return data.staff
}

/** Resolves to { user, temporaryPassword }. */
export async function createOfficer(details) {
  const { data } = await apiClient.post('/staff/officers', details)
  return data
}

export async function setOfficerStatus(id, status) {
  const { data } = await apiClient.patch(`/staff/officers/${encodeURIComponent(id)}/status`, { status })
  return data.user
}

export async function getMyCollege() {
  const { data } = await apiClient.get('/college/me')
  return data.college
}
