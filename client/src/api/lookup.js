import apiClient from './client.js'

/** "Check before you pay": resolves to { resultStatus, queryType, fraudMatches, verifiedRecruiters, lookalikeOf, guidance }. */
export async function lookup(q) {
  const { data } = await apiClient.get('/lookup', { params: { q } })
  return data
}
