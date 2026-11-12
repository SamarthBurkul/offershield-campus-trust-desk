import axios from 'axios'
import { trackRequest } from './slowRequests.js'

// The single HTTP client for the app. All API calls must go through this instance.
const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || '/api/v1',
  withCredentials: true,
  // Generous enough for a free-plan server that is waking up (up to about a minute).
  timeout: 70_000,
  headers: { Accept: 'application/json' },
})

// Mark requests that stay pending, so the UI can say the server is starting (non-blocking).
// Synchronous, so the 5-second clock starts when the request is made.
apiClient.interceptors.request.use(
  (request) => {
    request.settleTracking = trackRequest()
    return request
  },
  null,
  { synchronous: true },
)
apiClient.interceptors.response.use(
  (response) => {
    response.config.settleTracking?.()
    return response
  },
  (error) => {
    error.config?.settleTracking?.()
    return Promise.reject(error)
  },
)

export default apiClient
