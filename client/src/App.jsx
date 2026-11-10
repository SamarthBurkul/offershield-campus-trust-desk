import { AuthProvider } from './auth/AuthContext.jsx'
import AppRoutes from './routes/AppRoutes.jsx'

// The router itself is provided by main.jsx (BrowserRouter) or by tests (MemoryRouter).
export default function App() {
  return (
    <AuthProvider>
      <AppRoutes />
    </AuthProvider>
  )
}
