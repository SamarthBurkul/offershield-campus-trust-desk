import { Route, Routes } from 'react-router-dom'
import { ROLES, STAFF_ROLES } from '../auth/roles.js'
import Layout from '../components/Layout.jsx'
import ProtectedRoute from '../components/ProtectedRoute.jsx'
import AdminCollegeDetailPage from '../pages/AdminCollegeDetailPage.jsx'
import AdminCollegesPage from '../pages/AdminCollegesPage.jsx'
import AuditLogPage from '../pages/AuditLogPage.jsx'
import CaseQueuePage from '../pages/CaseQueuePage.jsx'
import ChangePasswordPage from '../pages/ChangePasswordPage.jsx'
import AdvisoriesPage from '../pages/AdvisoriesPage.jsx'
import AdvisoryDetailPage from '../pages/AdvisoryDetailPage.jsx'
import LandingPage from '../pages/LandingPage.jsx'
import NotificationsPage from '../pages/NotificationsPage.jsx'
import StaffAdvisoriesPage from '../pages/StaffAdvisoriesPage.jsx'
import StaffAdvisoryEditPage from '../pages/StaffAdvisoryEditPage.jsx'
import StatsPage from '../pages/StatsPage.jsx'
import LoginPage from '../pages/LoginPage.jsx'
import MyRequestsPage from '../pages/MyRequestsPage.jsx'
import NewRequestPage from '../pages/NewRequestPage.jsx'
import NotFoundPage from '../pages/NotFoundPage.jsx'
import RegisterPage from '../pages/RegisterPage.jsx'
import RegistryPage from '../pages/RegistryPage.jsx'
import RequestDetailPage from '../pages/RequestDetailPage.jsx'
import StaffCaseDetailPage from '../pages/StaffCaseDetailPage.jsx'
import StaffHomePage from '../pages/StaffHomePage.jsx'
import StaffMembersPage from '../pages/StaffMembersPage.jsx'
import StudentHomePage from '../pages/StudentHomePage.jsx'

export default function AppRoutes() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<LandingPage />} />
        <Route path="login" element={<LoginPage />} />
        <Route path="register" element={<RegisterPage />} />

        <Route element={<ProtectedRoute />}>
          <Route path="change-password" element={<ChangePasswordPage />} />
        </Route>
        <Route element={<ProtectedRoute allowedRoles={[ROLES.STUDENT, ...STAFF_ROLES]} />}>
          <Route path="notifications" element={<NotificationsPage />} />
        </Route>
        <Route element={<ProtectedRoute allowedRoles={[ROLES.STUDENT]} />}>
          <Route path="student" element={<StudentHomePage />} />
          <Route path="student/requests" element={<MyRequestsPage />} />
          <Route path="student/requests/new" element={<NewRequestPage />} />
          <Route path="student/requests/:id" element={<RequestDetailPage />} />
          <Route path="advisories" element={<AdvisoriesPage />} />
          <Route path="advisories/:id" element={<AdvisoryDetailPage />} />
        </Route>
        <Route element={<ProtectedRoute allowedRoles={STAFF_ROLES} />}>
          <Route path="staff" element={<StaffHomePage />} />
          {/* Officers may view the list; only TPO heads see the management controls. */}
          <Route path="staff/members" element={<StaffMembersPage />} />
          <Route path="staff/cases" element={<CaseQueuePage />} />
          <Route path="staff/cases/:id" element={<StaffCaseDetailPage />} />
          <Route path="staff/registry" element={<RegistryPage />} />
          <Route path="staff/advisories" element={<StaffAdvisoriesPage />} />
          <Route path="staff/advisories/new" element={<StaffAdvisoryEditPage />} />
          <Route path="staff/advisories/:id" element={<StaffAdvisoryEditPage />} />
          <Route path="staff/stats" element={<StatsPage />} />
        </Route>
        <Route element={<ProtectedRoute allowedRoles={[ROLES.TPO_HEAD]} />}>
          <Route path="staff/audit" element={<AuditLogPage />} />
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
