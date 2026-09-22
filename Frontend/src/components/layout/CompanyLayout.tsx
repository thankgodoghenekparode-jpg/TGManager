import { Outlet, useNavigate } from 'react-router-dom'
import DashboardIcon from '@mui/icons-material/Dashboard'
import ApartmentIcon from '@mui/icons-material/Apartment'
import PeopleIcon from '@mui/icons-material/People'
import AdminPanelSettingsIcon from '@mui/icons-material/AdminPanelSettings'
import GroupsIcon from '@mui/icons-material/Groups'
import AccountTreeIcon from '@mui/icons-material/AccountTree'
import EventNoteIcon from '@mui/icons-material/EventNote'
import ChatIcon from '@mui/icons-material/Chat'
import DescriptionIcon from '@mui/icons-material/Description'
import ArticleIcon from '@mui/icons-material/Article'
import Inventory2Icon from '@mui/icons-material/Inventory2'
import BallotIcon from '@mui/icons-material/Ballot'
import PlaylistAddCheckIcon from '@mui/icons-material/PlaylistAddCheck'
import BarChartIcon from '@mui/icons-material/BarChart'
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth'
import HistoryIcon from '@mui/icons-material/History'
import ApiIcon from '@mui/icons-material/Api'
import SettingsIcon from '@mui/icons-material/Settings'
import CreditCardIcon from '@mui/icons-material/CreditCard'
import { AppShell, type NavItem } from './AppShell'
import { useAuthStore } from '../../store/auth'
import { useTenantStore } from '../../store/tenant'
import { hasPermission } from '../PermissionGate'
import { PermissionBlocks } from '../../lib/nav'
import { FloatingChatButton } from '../FloatingChatButton'
import { useChatNotificationSound } from '../../hooks/useChatNotificationSound'

export function CompanyLayout() {
  const navigate = useNavigate()
  const user = useAuthStore((s) => s.user)
  const logout = useAuthStore((s) => s.logout)
  const tenant = useTenantStore((s) => s.current)

  const role = user?.role
  const isCompanyAdmin = tenant?.isCompanyAdmin ?? false
  const tenantPermissions = tenant?.permissions ?? []

  const allowed = (perms: readonly string[]) =>
    hasPermission({ role, isCompanyAdmin, tenantPermissions, required: perms })

  const featureFlags = tenant?.featureFlags ?? {}
  const isFeatureEnabled = (feat?: string) => {
    if (!feat) return true
    if (featureFlags[feat] === false) return false
    return true
  }

  const all: Array<{ item: NavItem; perms: readonly string[]; feature?: string }> = [
    { item: { label: 'Dashboard', path: '/app', icon: DashboardIcon }, perms: [] },
    { item: { label: 'Branches', path: '/app/branches', icon: ApartmentIcon }, perms: PermissionBlocks.BRANCH, feature: 'branches' },
    { item: { label: 'Departments', path: '/app/departments', icon: AccountTreeIcon }, perms: PermissionBlocks.DEPARTMENT, feature: 'departments' },
    { item: { label: 'Groups', path: '/app/groups', icon: GroupsIcon }, perms: PermissionBlocks.GROUP, feature: 'groups' },
    { item: { label: 'Staff', path: '/app/staff', icon: PeopleIcon }, perms: PermissionBlocks.STAFF, feature: 'staff' },
    { item: { label: 'Roles', path: '/app/roles', icon: AdminPanelSettingsIcon }, perms: PermissionBlocks.ROLE, feature: 'roles' },
    { item: { label: 'Schedules', path: '/app/schedules', icon: EventNoteIcon }, perms: ['schedule.manage'], feature: 'schedules' },
    { item: { label: 'Attendance', path: '/app/attendance', icon: EventNoteIcon }, perms: PermissionBlocks.ATTENDANCE, feature: 'attendance' },
    { item: { label: 'Chat', path: '/app/chat', icon: ChatIcon }, perms: ['chat.view', 'chat.create'], feature: 'chat' },
    { item: { label: 'Documents', path: '/app/documents', icon: DescriptionIcon }, perms: PermissionBlocks.DOCUMENT, feature: 'documents' },
    { item: { label: 'Memos', path: '/app/memos', icon: ArticleIcon }, perms: PermissionBlocks.MEMO, feature: 'memos' },
    { item: { label: 'Inventory', path: '/app/inventory', icon: Inventory2Icon }, perms: PermissionBlocks.INVENTORY, feature: 'inventory' },
    { item: { label: 'Forms', path: '/app/forms', icon: BallotIcon }, perms: PermissionBlocks.FORM, feature: 'forms' },
    { item: { label: 'Workflows', path: '/app/workflows', icon: PlaylistAddCheckIcon }, perms: PermissionBlocks.WORKFLOW, feature: 'workflows' },
    { item: { label: 'Reports', path: '/app/reports', icon: BarChartIcon }, perms: ['report.view'], feature: 'reports' },
    { item: { label: 'Weekly Reports', path: '/app/weekly-reports', icon: CalendarMonthIcon }, perms: ['report.submit'], feature: 'weeklyReports' },
    { item: { label: 'Audit', path: '/app/audit', icon: HistoryIcon }, perms: PermissionBlocks.AUDIT, feature: 'audit' },
    { item: { label: 'Integrations', path: '/app/integrations', icon: ApiIcon }, perms: PermissionBlocks.INTEGRATION, feature: 'integrations' },
    { item: { label: 'Settings', path: '/app/settings', icon: SettingsIcon }, perms: PermissionBlocks.SETTINGS, feature: 'settings' },
    { item: { label: 'Billing', path: '/app/billing', icon: CreditCardIcon }, perms: PermissionBlocks.SETTINGS, feature: 'billing' },
  ]

  const nav = all.filter(({ perms, feature }) => isFeatureEnabled(feature) && allowed(perms)).map(({ item }) => item)

  const chatAccess = isFeatureEnabled('chat') && allowed(['chat.view', 'chat.create'])
  useChatNotificationSound(chatAccess)

  return (
    <AppShell
      title="TGManager"
      subtitle={tenant?.name ?? 'Company'}
      nav={nav}
      onNavigateHome={() => navigate('/app')}
      onLogout={async () => {
        useTenantStore.getState().clear()
        await logout()
        navigate('/login')
      }}
    >
      {user ? <Outlet /> : null}
      {chatAccess && <FloatingChatButton />}
    </AppShell>
  )
}
