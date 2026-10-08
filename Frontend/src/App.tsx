import { useEffect, useState } from 'react'
import { QueryClientProvider } from '@tanstack/react-query'
import { Box, CircularProgress } from '@mui/material'
import { createBrowserRouter, RouterProvider, useLocation, useNavigate } from 'react-router-dom'
import { AppThemeProvider } from './contexts/ThemeContext'
import { queryClient } from './lib/query'
import { useAuthStore } from './store/auth'
import { useTenantStore } from './store/tenant'
import { getTenantId, setTenantId } from './api/client'
import { AuthGuard, GuestGuard, PlatformGuard, CompanyGuard, SchoolGuard } from './router/guards'
import { PlatformLayout } from './components/layout/PlatformLayout'
import { CompanyLayout } from './components/layout/CompanyLayout'
import { SchoolLayout } from './components/layout/SchoolLayout'
import { SchoolDashboardPage } from './pages/school/SchoolDashboard'
import { StudentsPage } from './pages/school/StudentsPage'
import { ClassesPage } from './pages/school/ClassesPage'
import { AttendancePage as SchoolAttendancePage } from './pages/school/AttendancePage'
import { GradingPage } from './pages/school/GradingPage'
import { FeesPage } from './pages/school/FeesPage'
import { SchoolSettingsPage } from './pages/school/SchoolSettingsPage'
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

const router = createBrowserRouter([
  { path: '/', element: <PortfolioPage /> },
  { path: '/portfolio', element: <PortfolioPage /> },
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
              { path: '/school/students', element: <StudentsPage /> },
              { path: '/school/classes', element: <ClassesPage /> },
              { path: '/school/attendance', element: <SchoolAttendancePage /> },
              { path: '/school/grading', element: <GradingPage /> },
              { path: '/school/fees', element: <FeesPage /> },
              { path: '/school/staff', element: <StaffPage /> },
              { path: '/school/chat', element: <ChatPage /> },
              { path: '/school/memos', element: <MemosPage /> },
              { path: '/school/settings', element: <SchoolSettingsPage /> },
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
