import { Outlet, useNavigate } from 'react-router-dom';
import DashboardIcon from '@mui/icons-material/Dashboard';
import SchoolIcon from '@mui/icons-material/School';
import ClassIcon from '@mui/icons-material/Class';
import QrCodeScannerIcon from '@mui/icons-material/QrCodeScanner';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import AssessmentIcon from '@mui/icons-material/Assessment';
import ScheduleIcon from '@mui/icons-material/Schedule';
import ReceiptLongIcon from '@mui/icons-material/ReceiptLong';
import PeopleIcon from '@mui/icons-material/People';
import AdminPanelSettingsIcon from '@mui/icons-material/AdminPanelSettings';
import FamilyRestroomIcon from '@mui/icons-material/FamilyRestroom';
import ChatIcon from '@mui/icons-material/Chat';
import CampaignIcon from '@mui/icons-material/Campaign';
import SettingsIcon from '@mui/icons-material/Settings';
import { AppShell, type NavItem } from './AppShell';
import { useAuthStore } from '../../store/auth';
import { useTenantStore } from '../../store/tenant';
import { hasPermission } from '../PermissionGate';
import { SchoolPermissionBlocks } from '../../lib/nav';
import { FloatingChatButton } from '../FloatingChatButton';
import { useChatNotificationSound } from '../../hooks/useChatNotificationSound';

export function SchoolLayout() {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const tenant = useTenantStore((s) => s.current);

  const role = user?.role;
  const isCompanyAdmin = tenant?.isCompanyAdmin ?? false;
  const tenantPermissions = tenant?.permissions ?? [];
  const allowed = (perms: readonly string[]) =>
    hasPermission({ role, isCompanyAdmin, tenantPermissions, required: perms });

  const all: Array<{ item: NavItem; perms: readonly string[] }> = [
    { item: { label: 'Overview', path: '/school', icon: DashboardIcon }, perms: SchoolPermissionBlocks.DASHBOARD },
    { item: { label: 'Students & ID Cards', path: '/school/students', icon: SchoolIcon }, perms: SchoolPermissionBlocks.STUDENTS },
    { item: { label: 'Classes & Academics', path: '/school/classes', icon: ClassIcon }, perms: SchoolPermissionBlocks.CLASSES },
    { item: { label: 'Gate Attendance', path: '/school/attendance', icon: QrCodeScannerIcon }, perms: SchoolPermissionBlocks.GATE_ATTENDANCE },
    { item: { label: 'Staff Clock In/Out', path: '/school/staff-attendance', icon: AccessTimeIcon }, perms: SchoolPermissionBlocks.STAFF_ATTENDANCE },
    { item: { label: 'Grading & Report Cards', path: '/school/grading', icon: AssessmentIcon }, perms: SchoolPermissionBlocks.GRADING },
    { item: { label: 'Timetable', path: '/school/timetable', icon: ScheduleIcon }, perms: SchoolPermissionBlocks.TIMETABLE },
    { item: { label: 'Fees & Invoices', path: '/school/fees', icon: ReceiptLongIcon }, perms: SchoolPermissionBlocks.FEES },
    { item: { label: 'Staff & Teachers', path: '/school/staff', icon: PeopleIcon }, perms: SchoolPermissionBlocks.STAFF },
    { item: { label: 'Roles & Permissions', path: '/school/roles', icon: AdminPanelSettingsIcon }, perms: SchoolPermissionBlocks.ROLES },
    { item: { label: 'Parents Portal', path: '/school/parents', icon: FamilyRestroomIcon }, perms: SchoolPermissionBlocks.PARENTS },
    { item: { label: 'Staff Chat', path: '/school/chat', icon: ChatIcon }, perms: SchoolPermissionBlocks.CHAT },
    { item: { label: 'Announcements', path: '/school/announcements', icon: CampaignIcon }, perms: SchoolPermissionBlocks.ANNOUNCEMENTS },
    { item: { label: 'School Settings', path: '/school/settings', icon: SettingsIcon }, perms: SchoolPermissionBlocks.SETTINGS },
  ];

  // Only render menu entries the current role is permitted to open.
  const nav = all.filter(({ perms }) => allowed(perms)).map(({ item }) => item);

  const chatAccess = allowed(SchoolPermissionBlocks.CHAT);
  useChatNotificationSound(chatAccess);

  return (
    <AppShell
      title={tenant?.name ?? 'School Workspace'}
      subtitle={tenant?.schoolProfile?.schoolType ? `${tenant.schoolProfile.schoolType} School` : 'School Portal'}
      nav={nav}
      onNavigateHome={() => navigate('/school')}
      onLogout={async () => {
        useTenantStore.getState().clear();
        await logout();
        navigate('/login');
      }}
    >
      {user ? <Outlet /> : null}
      {chatAccess && <FloatingChatButton />}
    </AppShell>
  );
}
