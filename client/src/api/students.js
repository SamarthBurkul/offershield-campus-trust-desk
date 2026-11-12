import apiClient from './client.js'

/** Resolves to { students, page, limit, total, pendingCount }. */
export async function listStudents(params = {}) {
  const { data } = await apiClient.get('/staff/students', { params })
  return data
}

export async function approveStudent(id) {
  const { data } = await apiClient.post(`/staff/students/${encodeURIComponent(id)}/approve`, {})
  return data.student
}

export async function rejectStudent(id, reason) {
  const { data } = await apiClient.post(`/staff/students/${encodeURIComponent(id)}/reject`, reason ? { reason } : {})
  return data.student
}

/** Resolves to { approved: string[], skipped: number }. */
export async function bulkApproveStudents(ids) {
  const { data } = await apiClient.post('/staff/students/bulk-approve', { ids })
  return data
}

export async function setStudentStatus(id, status) {
  const { data } = await apiClient.patch(`/staff/students/${encodeURIComponent(id)}/status`, { status })
  return data.student
}

/** Resolves to { user, temporaryPassword }. The password is shown once and never stored. */
export async function resetUserPassword(id) {
  const { data } = await apiClient.post(`/staff/users/${encodeURIComponent(id)}/reset-password`, {})
  return data
}
