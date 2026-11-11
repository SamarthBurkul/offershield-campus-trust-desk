import apiClient from './client.js'

/** College statistics for staff; `from`/`to` are YYYY-MM-DD (defaults: last 90 days). */
export async function getStats({ from, to } = {}) {
  const params = {}
  if (from) params.from = from
  if (to) params.to = `${to}T23:59:59.999Z`
  const { data } = await apiClient.get('/staff/stats', { params })
  return data.stats
}
