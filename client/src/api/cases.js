import apiClient from './client.js'

/** Resolves to the created case (student view). */
export async function createCase(details) {
  const { data } = await apiClient.post('/cases', details)
  return data.case
}

/** Resolves to { cases, page, limit, total }. */
export async function listMyCases({ status, page = 1, limit = 20 } = {}) {
  const params = { page, limit }
  if (status) params.status = status
  const { data } = await apiClient.get('/cases/mine', { params })
  return data
}

/** Resolves to { case, events, evidence }. */
export async function getCase(id) {
  const { data } = await apiClient.get(`/cases/${encodeURIComponent(id)}`)
  return data
}

/** Resolves to the refreshed { case, events, evidence }. */
export async function sendMessage(id, body) {
  const { data } = await apiClient.post(`/cases/${encodeURIComponent(id)}/messages`, { body })
  return data
}

/** Resolves to the stored evidence list for this upload. */
export async function uploadEvidence(id, files) {
  const form = new FormData()
  for (const file of files) form.append('files', file)
  const { data } = await apiClient.post(`/cases/${encodeURIComponent(id)}/evidence`, form, { timeout: 60_000 })
  return data.evidence
}

/** Resolves to { url, expiresAt } — a short-lived link that also needs the session cookie. */
export async function getEvidenceLink(caseId, evidenceId) {
  const { data } = await apiClient.post(
    `/cases/${encodeURIComponent(caseId)}/evidence/${encodeURIComponent(evidenceId)}/link`,
  )
  return data
}
