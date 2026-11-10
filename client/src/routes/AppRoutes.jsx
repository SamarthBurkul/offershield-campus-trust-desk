import { Route, Routes } from 'react-router-dom'
import { ROLES, STAFF_ROLES } from '../auth/roles.js'
import Layout from '../components/Layout.jsx'
import ProtectedRoute from '../components/ProtectedRoute.jsx'
import AdminCollegeDetailPage from '../pages/AdminCollegeDetailPage.jsx'
import AdminCollegesPage from '../pages/AdminCollegesPage.jsx'
import ChangePasswordPage from '../pages/ChangePasswordPage.jsx'
import HomePage from '../pages/HomePage.jsx'
import LoginPage from '../pages/LoginPage.jsx'
import NotFoundPage from '../pages/NotFoundPage.jsx'
import RegisterPage from '../pages/RegisterPage.jsx'
import StaffHomePage from '../pages/StaffHomePage.jsx'
import StaffMembersPage from '../pages/StaffMembersPage.jsx'
import StudentHomePage from '../pages/StudentHomePage.jsx'

export default function AppRoutes() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<HomePage />} />
        <Route path="login" element={<LoginPage />} />
        <Route path="register" element={<RegisterPage />} />

        <Route element={<ProtectedRoute />}>
          <Route path="change-password" element={<ChangePasswordPage />} />
        </Route>
        <Route element={<ProtectedRoute allowedRoles={[ROLES.STUDENT]} />}>
          <Route path="student" element={<StudentHomePage />} />
        </Route>
        <Route element={<ProtectedRoute allowedRoles={STAFF_ROLES} />}>
          <Route path="staff" element={<StaffHomePage />} />
          {/* Officers may view the list; only TPO heads see the management controls. */}
          <Route path="staff/members" element={<StaffMembersPage />} />
        </Route>
        <Route element={<ProtectedRoute allowedRoles={[ROLES.SUPER_ADMIN]} />}>
          <Route path="admin" element={<AdminCollegesPage />} />
          <Route path="admin/colleges/:id" element={<AdminCollegeDetailPage />} />
        </Route>

        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  )
}
