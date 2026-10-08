import { Outlet, useNavigate } from 'react-router-dom';
import DashboardIcon from '@mui/icons-material/Dashboard';
import SchoolIcon from '@mui/icons-material/School';
import ClassIcon from '@mui/icons-material/Class';
import QrCodeScannerIcon from '@mui/icons-material/QrCodeScanner';
import AssessmentIcon from '@mui/icons-material/Assessment';
import ReceiptLongIcon from '@mui/icons-material/ReceiptLong';
import PeopleIcon from '@mui/icons-material/People';
import ChatIcon from '@mui/icons-material/Chat';
import CampaignIcon from '@mui/icons-material/Campaign';
import SettingsIcon from '@mui/icons-material/Settings';
import { AppShell, type NavItem } from './AppShell';
import { useAuthStore } from '../../store/auth';
import { useTenantStore } from '../../store/tenant';
import { FloatingChatButton } from '../FloatingChatButton';
import { useChatNotificationSound } from '../../hooks/useChatNotificationSound';

export function SchoolLayout() {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const tenant = useTenantStore((s) => s.current);

  const nav: NavItem[] = [
    { label: 'Overview', path: '/school', icon: DashboardIcon },
    { label: 'Students & ID Cards', path: '/school/students', icon: SchoolIcon },
    { label: 'Classes & Academics', path: '/school/classes', icon: ClassIcon },
    { label: 'Gate Attendance', path: '/school/attendance', icon: QrCodeScannerIcon },
    { label: 'Grading & Report Cards', path: '/school/grading', icon: AssessmentIcon },
    { label: 'Fees & Invoices', path: '/school/fees', icon: ReceiptLongIcon },
    { label: 'Staff & Teachers', path: '/app/staff', icon: PeopleIcon },
    { label: 'Staff Chat', path: '/app/chat', icon: ChatIcon },
    { label: 'Announcements', path: '/app/memos', icon: CampaignIcon },
    { label: 'School Settings', path: '/school/settings', icon: SettingsIcon },
  ];

  useChatNotificationSound(true);

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
      <FloatingChatButton />
    </AppShell>
  );
}
