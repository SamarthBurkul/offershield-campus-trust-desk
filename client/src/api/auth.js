import apiClient from './client.js'

export async function getMe() {
  const { data } = await apiClient.get('/auth/me')
  return data
}

export async function login(credentials) {
  const { data } = await apiClient.post('/auth/login', credentials)
  return data
}

export async function register(details) {
  const { data } = await apiClient.post('/auth/register', details)
  return data
}

export async function logout() {
  await apiClient.post('/auth/logout')
}

export async function changePassword(passwords) {
  const { data } = await apiClient.post('/auth/change-password', passwords)
  return data
}
