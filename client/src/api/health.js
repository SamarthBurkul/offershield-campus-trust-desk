import apiClient from './client.js'

export async function getHealth() {
  const { data } = await apiClient.get('/health')
  return data
}
