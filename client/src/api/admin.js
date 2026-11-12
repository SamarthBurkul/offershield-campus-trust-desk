import apiClient from './client.js'

export async function listColleges() {
  const { data } = await apiClient.get('/admin/colleges')
  return data.colleges
}

export async function getCollege(id) {
  const { data } = await apiClient.get(`/admin/colleges/${encodeURIComponent(id)}`)
  return data.college
}

/** Resolves to { college, studentJoinCode }. The join code is only ever returned here. */
export async function createCollege(details) {
  const { data } = await apiClient.post('/admin/colleges', details)
  return data
}

export async function updateCollege(id, changes) {
  const { data } = await apiClient.patch(`/admin/colleges/${encodeURIComponent(id)}`, changes)
  return data.college
}

/** Resolves to { college, studentJoinCode }. */
export async function rotateJoinCode(id) {
  const { data } = await apiClient.post(`/admin/colleges/${encodeURIComponent(id)}/rotate-join-code`)
  return data
}

/** Resolves to { user, temporaryPassword }. */
export async function createTpoHead(id, details) {
  const { data } = await apiClient.post(`/admin/colleges/${encodeURIComponent(id)}/tpo-heads`, details)
  return data
}

export async function listCollegeStaff(id) {
  const { data } = await apiClient.get(`/admin/colleges/${encodeURIComponent(id)}/staff`)
  return data.staff
}

/** Super admin resets a TPO head. Resolves to { user, temporaryPassword }. */
export async function resetTpoHeadPassword(userId) {
  const { data } = await apiClient.post(`/admin/users/${encodeURIComponent(userId)}/reset-password`, {})
  return data
}
