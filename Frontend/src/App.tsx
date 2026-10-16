import { useEffect, useState } from 'react'
import { QueryClientProvider } from '@tanstack/react-query'
import { Box, CircularProgress } from '@mui/material'
import { createBrowserRouter, Navigate, RouterProvider, useLocation, useNavigate } from 'react-router-dom'
import { AppThemeProvider } from './contexts/ThemeContext'
import { queryClient } from './lib/query'
import { useAuthStore } from './store/auth'
import { useTenantStore } from './store/tenant'
import { getTenantId, setTenantId } from './api/client'
import { AuthGuard, GuestGuard, PlatformGuard, CompanyGuard, SchoolGuard, ParentGuard, RequirePermission } from './router/guards'
import { PlatformLayout } from './components/layout/PlatformLayout'
import { CompanyLayout } from './components/layout/CompanyLayout'
import { SchoolLayout } from './components/layout/SchoolLayout'
import { ParentLayout } from './components/layout/ParentLayout'
import { SchoolDashboardPage } from './pages/school/SchoolDashboard'
import { StudentsPage } from './pages/school/StudentsPage'
import { ClassesPage } from './pages/school/ClassesPage'
import { AttendancePage as SchoolAttendancePage } from './pages/school/AttendancePage'
import { SchoolStaffAttendancePage } from './pages/school/SchoolStaffAttendancePage'
import { GradingPage } from './pages/school/GradingPage'
import { TimetablePage } from './pages/school/TimetablePage'
import { SchoolStaffPage } from './pages/school/SchoolStaffPage'
import { SchoolParentsPage } from './pages/school/SchoolParentsPage'
import { AnnouncementsPage } from './pages/school/AnnouncementsPage'
import { FeesPage } from './pages/school/FeesPage'
import { SchoolSettingsPage } from './pages/school/SchoolSettingsPage'

import { CbtDashboardPage } from './pages/school/cbt/CbtDashboard'
import { CbtPracticePage } from './pages/school/cbt/CbtPractice'
import { CbtHistoryPage } from './pages/school/cbt/CbtHistory'
import { CbtQuestionBankPage } from './pages/school/cbt/CbtQuestionBank'
import { CbtExamsPage } from './pages/school/cbt/CbtExams'
import { CbtExamBriefPage } from './pages/school/cbt/CbtExamBrief'
import { CbtAttemptPage } from './pages/school/cbt/CbtAttemptPage'
import { CbtExamReportPage } from './pages/school/cbt/CbtExamReport'
import { CbtPerformancePage } from './pages/school/cbt/CbtPerformance'
import { ParentDashboard } from './pages/parent/ParentDashboard'
import { ChildDetailPage } from './pages/parent/ChildDetailPage'
import { PortfolioPage } from './pages/Portfolio'
import { LoginPage } from './pages/auth/Login'
import { RegisterPage } from './pages/auth/Register'
import { ForgotPasswordPage } from './pages/auth/ForgotPassword'
import { ResetPasswordPage } from './pages/auth/ResetPassword'
import { PasswordResetRequestPage } from './pages/auth/PasswordResetRequest'
import { SelectCompanyPage } from './pages/SelectCompany'
import { PlatformDashboardPage } from './pages/platform/Dashboard'
import { TenantsPage } from './pages/platform/Tenants'
import { PlansPage } from './pages/platform/Plans'
import { UsersPage } from './pages/platform/Users'
import { SettingsPage } from './pages/platform/Settings'
import { AccountRequestsPage } from './pages/platform/AccountRequests'
import { CompanyDashboardPage } from './pages/company/Dashboard'
import { BranchesPage } from './pages/company/Branches'
import { DepartmentsPage } from './pages/company/Departments'
import { GroupsPage } from './pages/company/Groups'
import { StaffPage } from './pages/company/Staff'
import { RolesPage } from './pages/company/Roles'
import { SchedulesPage } from './pages/company/Schedules'
import { AttendancePage } from './pages/company/Attendance'
import { ChatPage } from './pages/company/Chat'
import { DocumentsPage } from './pages/company/Documents'
import { MemosPage } from './pages/company/Memos'
import { InventoryPage } from './pages/company/Inventory'
import { FormsPage } from './pages/company/Forms'
import { CustomerTicketsPage } from './pages/company/CustomerTickets'
import { WorkflowsPage } from './pages/company/Workflows'
import { ReportsPage } from './pages/company/Reports'
import { WeeklyReportsPage } from './pages/company/WeeklyReports'
import { AuditLogsPage } from './pages/company/AuditLogs'
import { IntegrationsPage } from './pages/company/Integrations'
import { CompanySettingsPage } from './pages/company/Settings'
import { BillingPage } from './pages/company/Billing'
import { ChangeEmailPage } from './pages/account/ChangeEmail'
import { MyRequestsPage } from './pages/account/MyRequests'
import { PWAInstallPrompt } from './components/PWAInstallPrompt'
import { ForSchoolsPage } from './pages/marketing/ForSchools'
import { SchoolPermissionBlocks } from './lib/nav'

const router = createBrowserRouter([
  { path: '/', element: <PortfolioPage /> },
  { path: '/portfolio', element: <PortfolioPage /> },
  { path: '/for-schools', element: <ForSchoolsPage /> },
  {
    element: <GuestGuard />,
    children: [
      { path: '/login', element: <LoginPage /> },
      { path: '/register', element: <RegisterPage /> },
      { path: '/forgot-password', element: <ForgotPasswordPage /> },
      { path: '/reset-password', element: <ResetPasswordPage /> },
      { path: '/password-reset-request', element: <PasswordResetRequestPage /> },
    ],
  },
  {
    element: <AuthGuard />,
    children: [
      { path: '/select-company', element: <SelectCompanyPage /> },
      {
        element: <PlatformGuard />,
        children: [
          {
            element: <PlatformLayout />,
            children: [
              { path: '/admin', element: <PlatformDashboardPage /> },
              { path: '/admin/tenants', element: <TenantsPage /> },
              { path: '/admin/plans', element: <PlansPage /> },
              { path: '/admin/users', element: <UsersPage /> },
              { path: '/admin/settings', element: <SettingsPage /> },
              { path: '/admin/account-requests', element: <AccountRequestsPage /> },
            ],
          },
        ],
      },
      {
        element: <CompanyGuard />,
        children: [
          {
            element: <CompanyLayout />,
            children: [
              { path: '/app', element: <CompanyDashboardPage /> },
              { path: '/app/branches', element: <BranchesPage /> },
              { path: '/app/departments', element: <DepartmentsPage /> },
              { path: '/app/groups', element: <GroupsPage /> },
              { path: '/app/staff', element: <StaffPage /> },
              { path: '/app/roles', element: <RolesPage /> },
              { path: '/app/schedules', element: <SchedulesPage /> },
              { path: '/app/attendance', element: <AttendancePage /> },
              { path: '/app/chat', element: <ChatPage /> },
              { path: '/app/documents', element: <DocumentsPage /> },
              { path: '/app/memos', element: <MemosPage /> },
              { path: '/app/inventory', element: <InventoryPage /> },
              { path: '/app/forms', element: <FormsPage /> },
              { path: '/app/customer-tickets', element: <CustomerTicketsPage /> },
              { path: '/app/workflows', element: <WorkflowsPage /> },
              { path: '/app/reports', element: <ReportsPage /> },
              { path: '/app/weekly-reports', element: <WeeklyReportsPage /> },
              { path: '/app/audit', element: <AuditLogsPage /> },
              { path: '/app/integrations', element: <IntegrationsPage /> },
              { path: '/app/settings', element: <CompanySettingsPage /> },
              { path: '/app/billing', element: <BillingPage /> },
              { path: '/app/account/change-email', element: <ChangeEmailPage /> },
              { path: '/app/account/requests', element: <MyRequestsPage /> },
            ],
          },
        ],
      },
      {
        element: <SchoolGuard />,
        children: [
          {
            element: <SchoolLayout />,
            children: [
              { path: '/school', element: <SchoolDashboardPage /> },
              { path: '/school/students', element: <RequirePermission permissions={SchoolPermissionBlocks.STUDENTS} redirectTo="/school"><StudentsPage /></RequirePermission> },
              { path: '/school/classes', element: <RequirePermission permissions={SchoolPermissionBlocks.CLASSES} redirectTo="/school"><ClassesPage /></RequirePermission> },
              { path: '/school/attendance', element: <RequirePermission permissions={SchoolPermissionBlocks.GATE_ATTENDANCE} redirectTo="/school"><SchoolAttendancePage /></RequirePermission> },
              { path: '/school/staff-attendance', element: <RequirePermission permissions={SchoolPermissionBlocks.STAFF_ATTENDANCE} redirectTo="/school"><SchoolStaffAttendancePage /></RequirePermission> },
              { path: '/school/grading', element: <RequirePermission permissions={SchoolPermissionBlocks.GRADING} redirectTo="/school"><GradingPage /></RequirePermission> },
              { path: '/school/cbt', element: <RequirePermission permissions={SchoolPermissionBlocks.CBT} redirectTo="/school"><CbtDashboardPage /></RequirePermission> },
              { path: '/school/cbt/practice', element: <RequirePermission permissions={SchoolPermissionBlocks.CBT_TAKE} redirectTo="/school"><CbtPracticePage /></RequirePermission> },
              { path: '/school/cbt/history', element: <RequirePermission permissions={SchoolPermissionBlocks.CBT_RESULT_VIEW} redirectTo="/school"><CbtHistoryPage /></RequirePermission> },
              { path: '/school/cbt/questions', element: <RequirePermission permissions={SchoolPermissionBlocks.CBT_BANK} redirectTo="/school"><CbtQuestionBankPage /></RequirePermission> },
              { path: '/school/cbt/exams', element: <RequirePermission permissions={SchoolPermissionBlocks.CBT_EXAMS} redirectTo="/school"><CbtExamsPage /></RequirePermission> },
              { path: '/school/cbt/exams/:id/report', element: <RequirePermission permissions={SchoolPermissionBlocks.CBT_REPORTS} redirectTo="/school"><CbtExamReportPage /></RequirePermission> },
              { path: '/school/cbt/exams/:id/brief', element: <RequirePermission permissions={SchoolPermissionBlocks.CBT_TAKE} redirectTo="/school"><CbtExamBriefPage /></RequirePermission> },
              { path: '/school/cbt/performance', element: <RequirePermission permissions={SchoolPermissionBlocks.CBT_REPORTS} redirectTo="/school"><CbtPerformancePage /></RequirePermission> },
              { path: '/school/cbt/attempts/:attemptId', element: <RequirePermission permissions={SchoolPermissionBlocks.CBT_TAKE} redirectTo="/school"><CbtAttemptPage /></RequirePermission> },
              { path: '/school/timetable', element: <RequirePermission permissions={SchoolPermissionBlocks.TIMETABLE} redirectTo="/school"><TimetablePage /></RequirePermission> },
              { path: '/school/fees', element: <RequirePermission permissions={SchoolPermissionBlocks.FEES} redirectTo="/school"><FeesPage /></RequirePermission> },
              { path: '/school/staff', element: <RequirePermission permissions={SchoolPermissionBlocks.STAFF} redirectTo="/school"><SchoolStaffPage /></RequirePermission> },
              { path: '/school/roles', element: <RequirePermission permissions={SchoolPermissionBlocks.ROLES} redirectTo="/school"><RolesPage /></RequirePermission> },
              { path: '/school/parents', element: <RequirePermission permissions={SchoolPermissionBlocks.PARENTS} redirectTo="/school"><SchoolParentsPage /></RequirePermission> },
              { path: '/school/chat', element: <RequirePermission permissions={SchoolPermissionBlocks.CHAT} redirectTo="/school"><ChatPage /></RequirePermission> },
              { path: '/school/announcements', element: <RequirePermission permissions={SchoolPermissionBlocks.ANNOUNCEMENTS} redirectTo="/school"><AnnouncementsPage /></RequirePermission> },
              { path: '/school/memos', element: <Navigate to="/school/announcements" replace /> },
              { path: '/school/settings', element: <RequirePermission permissions={SchoolPermissionBlocks.SETTINGS} redirectTo="/school"><SchoolSettingsPage /></RequirePermission> },
            ],
          },
        ],
      },
      {
        element: <ParentGuard />,
        children: [
          {
            element: <ParentLayout />,
            children: [
              { path: '/parent', element: <ParentDashboard /> },
              { path: '/parent/children/:id', element: <ChildDetailPage /> },
            ],
          },
        ],
      },
    ],
  },
  { path: '*', element: <RootRedirect /> },
])

function RootRedirect() {
  const navigate = useNavigate()
  const location = useLocation()
  const user = useAuthStore((s) => s.user)
  const memberships = useAuthStore((s) => s.memberships)
  const initialized = useAuthStore((s) => s.initialized)

  useEffect(() => {
    if (!initialized) return
    if (!user) {
      navigate('/login', { replace: true })
      return
    }
    const isPlatform = user.role === 'SUPER_ADMIN' || user.role === 'PLATFORM_SUPPORT'
    if (isPlatform) {
      navigate('/admin', { replace: true })
      return
    }
    const storedTenantId = getTenantId()
    const activeMembership = memberships.find((m) => m.id === storedTenantId)
    // A stored tenant id that the current user no longer belongs to is stale
    // (e.g. left over from a previous account), so clear it to force a clean
    // 'Choose a company' selection and avoid 'You are not a member of this tenant'.
    if (storedTenantId && !activeMembership) {
      setTenantId(null)
      navigate('/select-company', { replace: true })
    } else if (storedTenantId) {
      navigate(activeMembership?.type === 'SCHOOL' ? '/school' : '/app', { replace: true })
    } else {
      navigate('/select-company', { replace: true })
    }
  }, [initialized, user, memberships, navigate, location.pathname])

  return null
}

function AppBootstrap() {
  const bootstrap = useAuthStore((s) => s.bootstrap)
  const loadTenant = useTenantStore((s) => s.load)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    let cancelled = false

    async function initialize() {
      await bootstrap()
      if (getTenantId()) await loadTenant()
      if (!cancelled) setReady(true)
    }

    void initialize()
    return () => {
      cancelled = true
    }
  }, [bootstrap, loadTenant])

  if (!ready) {
    return (
      <Box sx={{ minHeight: '100vh', display: 'grid', placeItems: 'center', bgcolor: 'background.default' }}>
        <CircularProgress aria-label="Loading application" />
      </Box>
    )
  }

  return (
    <>
      <RouterProvider router={router} />
      <PWAInstallPrompt />
    </>
  )
}

export default function App() {
  return (
    <AppThemeProvider>
      <QueryClientProvider client={queryClient}>
        <AppBootstrap />
      </QueryClientProvider>
    </AppThemeProvider>
  )
}
