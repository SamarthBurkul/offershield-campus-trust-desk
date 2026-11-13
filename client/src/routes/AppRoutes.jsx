import { Suspense, lazy } from 'react'
import { Route, Routes } from 'react-router-dom'
import { ROLES, STAFF_ROLES } from '../auth/roles.js'
import Layout from '../components/Layout.jsx'
import ProtectedRoute from '../components/ProtectedRoute.jsx'
import { Skeleton } from '../components/ui/index.js'
import AdvisoriesPage from '../pages/AdvisoriesPage.jsx'
import AdvisoryDetailPage from '../pages/AdvisoryDetailPage.jsx'
import ChangePasswordPage from '../pages/ChangePasswordPage.jsx'
import LandingPage from '../pages/LandingPage.jsx'
import LoginPage from '../pages/LoginPage.jsx'
import MyRequestsPage from '../pages/MyRequestsPage.jsx'
import NewRequestPage from '../pages/NewRequestPage.jsx'
import NotFoundPage from '../pages/NotFoundPage.jsx'
import NotificationsPage from '../pages/NotificationsPage.jsx'
import PendingApprovalPage from '../pages/PendingApprovalPage.jsx'
import RegisterPage from '../pages/RegisterPage.jsx'
import RequestDetailPage from '../pages/RequestDetailPage.jsx'
import StudentHomePage from '../pages/StudentHomePage.jsx'

// Staff, admin and legal pages load on demand, so the student bundle stays lean.
const AdminCollegeDetailPage = lazy(() => import('../pages/AdminCollegeDetailPage.jsx'))
const AdminCollegesPage = lazy(() => import('../pages/AdminCollegesPage.jsx'))
const AuditLogPage = lazy(() => import('../pages/AuditLogPage.jsx'))
const CaseQueuePage = lazy(() => import('../pages/CaseQueuePage.jsx'))
const PrivacyPage = lazy(() => import('../pages/PrivacyPage.jsx'))
const RegistryPage = lazy(() => import('../pages/RegistryPage.jsx'))
const StaffAdvisoriesPage = lazy(() => import('../pages/StaffAdvisoriesPage.jsx'))
const StaffAdvisoryEditPage = lazy(() => import('../pages/StaffAdvisoryEditPage.jsx'))
const StaffCaseDetailPage = lazy(() => import('../pages/StaffCaseDetailPage.jsx'))
const StaffHomePage = lazy(() => import('../pages/StaffHomePage.jsx'))
const StaffMembersPage = lazy(() => import('../pages/StaffMembersPage.jsx'))
const StaffStudentsPage = lazy(() => import('../pages/StaffStudentsPage.jsx'))
const StatsPage = lazy(() => import('../pages/StatsPage.jsx'))
const TermsPage = lazy(() => import('../pages/TermsPage.jsx'))

const page = (element) => <Suspense fallback={<Skeleton rows={4} label="Loading page" />}>{element}</Suspense>

export default function AppRoutes() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<LandingPage />} />
        <Route path="login" element={<LoginPage />} />
        <Route path="register" element={<RegisterPage />} />
        <Route path="privacy" element={page(<PrivacyPage />)} />
        <Route path="terms" element={page(<TermsPage />)} />

        <Route element={<ProtectedRoute />}>
          <Route path="change-password" element={<ChangePasswordPage />} />
          <Route path="pending-approval" element={<PendingApprovalPage />} />
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
          <Route path="staff" element={page(<StaffHomePage />)} />
          {/* Officers may view the list; only TPO heads see the management controls. */}
          <Route path="staff/members" element={page(<StaffMembersPage />)} />
          <Route path="staff/cases" element={page(<CaseQueuePage />)} />
          <Route path="staff/cases/:id" element={page(<StaffCaseDetailPage />)} />
          <Route path="staff/registry" element={page(<RegistryPage />)} />
          <Route path="staff/advisories" element={page(<StaffAdvisoriesPage />)} />
          <Route path="staff/advisories/new" element={page(<StaffAdvisoryEditPage />)} />
          <Route path="staff/advisories/:id" element={page(<StaffAdvisoryEditPage />)} />
          <Route path="staff/stats" element={page(<StatsPage />)} />
          <Route path="staff/students" element={page(<StaffStudentsPage />)} />
        </Route>
        <Route element={<ProtectedRoute allowedRoles={[ROLES.TPO_HEAD]} />}>
          <Route path="staff/audit" element={page(<AuditLogPage />)} />
        </Route>
        <Route element={<ProtectedRoute allowedRoles={[ROLES.SUPER_ADMIN]} />}>
          <Route path="admin" element={page(<AdminCollegesPage />)} />
          <Route path="admin/colleges/:id" element={page(<AdminCollegeDetailPage />)} />
        </Route>

        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  )
}
