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
    { item: { label: 'Dashboard', path: '/app', icon: DashboardIcon, section: 'Main' }, perms: [] },
    { item: { label: 'Branches', path: '/app/branches', icon: ApartmentIcon, section: 'Organisation' }, perms: PermissionBlocks.BRANCH, feature: 'branches' },
    { item: { label: 'Departments', path: '/app/departments', icon: AccountTreeIcon, section: 'Organisation' }, perms: PermissionBlocks.DEPARTMENT, feature: 'departments' },
    { item: { label: 'Groups', path: '/app/groups', icon: GroupsIcon, section: 'Organisation' }, perms: PermissionBlocks.GROUP, feature: 'groups' },
    { item: { label: 'Staff', path: '/app/staff', icon: PeopleIcon, section: 'Organisation' }, perms: PermissionBlocks.STAFF, feature: 'staff' },
    { item: { label: 'Roles', path: '/app/roles', icon: AdminPanelSettingsIcon, section: 'Organisation' }, perms: PermissionBlocks.ROLE, feature: 'roles' },
    { item: { label: 'Schedules', path: '/app/schedules', icon: EventNoteIcon, section: 'Workforce' }, perms: ['schedule.manage'], feature: 'schedules' },
    { item: { label: 'Attendance', path: '/app/attendance', icon: EventNoteIcon, section: 'Workforce' }, perms: PermissionBlocks.ATTENDANCE, feature: 'attendance' },
    { item: { label: 'Chat', path: '/app/chat', icon: ChatIcon, section: 'Communication' }, perms: ['chat.view', 'chat.create'], feature: 'chat' },
    { item: { label: 'Documents', path: '/app/documents', icon: DescriptionIcon, section: 'Operations' }, perms: PermissionBlocks.DOCUMENT, feature: 'documents' },
    { item: { label: 'Memos', path: '/app/memos', icon: ArticleIcon, section: 'Operations' }, perms: PermissionBlocks.MEMO, feature: 'memos' },
    { item: { label: 'Inventory', path: '/app/inventory', icon: Inventory2Icon, section: 'Operations' }, perms: PermissionBlocks.INVENTORY, feature: 'inventory' },
    { item: { label: 'Forms', path: '/app/forms', icon: BallotIcon, section: 'Operations' }, perms: PermissionBlocks.FORM, feature: 'forms' },
    { item: { label: 'Workflows', path: '/app/workflows', icon: PlaylistAddCheckIcon, section: 'Operations' }, perms: PermissionBlocks.WORKFLOW, feature: 'workflows' },
    { item: { label: 'Reports', path: '/app/reports', icon: BarChartIcon, section: 'Insights' }, perms: ['report.view'], feature: 'reports' },
    { item: { label: 'Weekly Reports', path: '/app/weekly-reports', icon: CalendarMonthIcon, section: 'Insights' }, perms: ['report.submit'], feature: 'weeklyReports' },
    { item: { label: 'Audit', path: '/app/audit', icon: HistoryIcon, section: 'Insights' }, perms: PermissionBlocks.AUDIT, feature: 'audit' },
    { item: { label: 'Integrations', path: '/app/integrations', icon: ApiIcon, section: 'System' }, perms: PermissionBlocks.INTEGRATION, feature: 'integrations' },
    { item: { label: 'Settings', path: '/app/settings', icon: SettingsIcon, section: 'System' }, perms: PermissionBlocks.SETTINGS, feature: 'settings' },
    { item: { label: 'Billing', path: '/app/billing', icon: CreditCardIcon, section: 'System' }, perms: PermissionBlocks.SETTINGS, feature: 'billing' },
  ]

  const nav = all.filter(({ perms, feature }) => isFeatureEnabled(feature) && allowed(perms)).map(({ item }) => item)

  const chatAccess = isFeatureEnabled('chat') && allowed(['chat.view', 'chat.create'])
  useChatNotificationSound(chatAccess)

  return (
    <AppShell
      title={tenant?.name ?? 'Company Workspace'}
      subtitle="Corporate Workspace"
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
