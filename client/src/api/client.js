import axios from 'axios'

// The single HTTP client for the app. All API calls must go through this instance.
const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || '/api/v1',
  withCredentials: true,
  timeout: 10_000,
  headers: { Accept: 'application/json' },
})

export default apiClient
