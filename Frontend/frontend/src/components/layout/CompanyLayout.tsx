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
import ConfirmationNumberIcon from '@mui/icons-material/ConfirmationNumber'
import PlaylistAddCheckIcon from '@mui/icons-material/PlaylistAddCheck'
import BarChartIcon from '@mui/icons-material/BarChart'
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth'
import HistoryIcon from '@mui/icons-material/History'
import ApiIcon from '@mui/icons-material/Api'
import SettingsIcon from '@mui/icons-material/Settings'
import PlayArrowIcon from '@mui/icons-material/PlayArrow'
import { Button, Tooltip } from '@mui/material'
import { AppShell, type NavItem } from './AppShell'
import { useAuthStore } from '../../store/auth'
import { useTenantStore } from '../../store/tenant'
import { hasPermission } from '../PermissionGate'
import { PermissionBlocks } from '../../lib/nav'
import { canStartWorkflow } from '../../api/workflows'
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

  const canStart = canStartWorkflow(tenant?.roles ?? [])

  const all: Array<{ item: NavItem; perms: readonly string[] }> = [
    { item: { label: 'Dashboard', path: '/app', icon: DashboardIcon }, perms: [] },
    { item: { label: 'Branches', path: '/app/branches', icon: ApartmentIcon }, perms: PermissionBlocks.BRANCH },
    { item: { label: 'Departments', path: '/app/departments', icon: AccountTreeIcon }, perms: PermissionBlocks.DEPARTMENT },
    { item: { label: 'Groups', path: '/app/groups', icon: GroupsIcon }, perms: PermissionBlocks.GROUP },
    { item: { label: 'Staff', path: '/app/staff', icon: PeopleIcon }, perms: PermissionBlocks.STAFF },
    { item: { label: 'Roles', path: '/app/roles', icon: AdminPanelSettingsIcon }, perms: PermissionBlocks.ROLE },
    { item: { label: 'Schedules', path: '/app/schedules', icon: EventNoteIcon }, perms: ['schedule.manage'] },
    { item: { label: 'Attendance', path: '/app/attendance', icon: EventNoteIcon }, perms: PermissionBlocks.ATTENDANCE },
    { item: { label: 'Chat', path: '/app/chat', icon: ChatIcon }, perms: ['chat.view', 'chat.create'] },
    { item: { label: 'Documents', path: '/app/documents', icon: DescriptionIcon }, perms: PermissionBlocks.DOCUMENT },
    { item: { label: 'Memos', path: '/app/memos', icon: ArticleIcon }, perms: PermissionBlocks.MEMO },
    { item: { label: 'Inventory', path: '/app/inventory', icon: Inventory2Icon }, perms: PermissionBlocks.INVENTORY },
    { item: { label: 'Forms', path: '/app/forms', icon: BallotIcon }, perms: PermissionBlocks.FORM },
    { item: { label: 'Customer Tickets', path: '/app/customer-tickets', icon: ConfirmationNumberIcon }, perms: PermissionBlocks.FORM },
    { item: { label: 'Workflows', path: '/app/workflows', icon: PlaylistAddCheckIcon }, perms: PermissionBlocks.WORKFLOW },
    { item: { label: 'Reports', path: '/app/reports', icon: BarChartIcon }, perms: ['report.view'] },
    { item: { label: 'Weekly Reports', path: '/app/weekly-reports', icon: CalendarMonthIcon }, perms: ['report.submit'] },
    { item: { label: 'Audit', path: '/app/audit', icon: HistoryIcon }, perms: PermissionBlocks.AUDIT },
    { item: { label: 'Integrations', path: '/app/integrations', icon: ApiIcon }, perms: PermissionBlocks.INTEGRATION },
    { item: { label: 'Settings', path: '/app/settings', icon: SettingsIcon }, perms: PermissionBlocks.SETTINGS },
  ]

  const nav = all.filter(({ perms }) => allowed(perms)).map(({ item }) => item)

  const startButton = (
    <Tooltip title={canStart ? 'Start a workflow flow' : 'Only the Secretary or Account Assist can start a workflow flow'}>
      <span>
        <Button
          variant="contained"
          size="small"
          startIcon={<PlayArrowIcon />}
          disabled={!canStart}
          onClick={() => navigate('/app/workflows')}
          sx={{ mr: { xs: 0, sm: 1 }, width: { xs: '100%', sm: 'auto' } }}
        >
          Start workflow
        </Button>
      </span>
    </Tooltip>
  )

  const chatAccess = allowed(['chat.view', 'chat.create'])
  useChatNotificationSound(chatAccess)

  return (
    <AppShell
      title="Zarox"
      subtitle={tenant?.name ?? 'Company'}
      nav={nav}
      actions={startButton}
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
