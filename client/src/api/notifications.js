import apiClient from './client.js'

/** Resolves to { notifications, page, limit, total, unreadCount }. */
export async function listNotifications({ unread = false, page = 1, limit = 20 } = {}) {
  const params = { page, limit }
  if (unread) params.unread = 'true'
  const { data } = await apiClient.get('/notifications', { params })
  return data
}

export async function getUnreadCount() {
  const { data } = await apiClient.get('/notifications/unread-count')
  return data.unreadCount
}

export async function markNotificationRead(id) {
  await apiClient.post(`/notifications/${encodeURIComponent(id)}/read`, {})
}

export async function markAllNotificationsRead() {
  await apiClient.post('/notifications/read-all', {})
}
