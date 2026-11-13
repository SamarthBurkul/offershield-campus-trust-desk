import { AuthProvider } from './auth/AuthContext.jsx'
import { NavCountsProvider } from './components/layout/NavCounts.jsx'
import { ToastProvider } from './components/ui/index.js'
import AppRoutes from './routes/AppRoutes.jsx'

// The router itself is provided by main.jsx (BrowserRouter) or by tests (MemoryRouter).
export default function App() {
  return (
    <AuthProvider>
      <ToastProvider>
        <NavCountsProvider>
          <AppRoutes />
        </NavCountsProvider>
      </ToastProvider>
    </AuthProvider>
  )
}
