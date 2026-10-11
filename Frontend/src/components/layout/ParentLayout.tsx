import { Outlet, useNavigate } from 'react-router-dom';
import DashboardIcon from '@mui/icons-material/Dashboard';
import { AppShell, type NavItem } from './AppShell';
import { useAuthStore } from '../../store/auth';
import { useTenantStore } from '../../store/tenant';

export function ParentLayout() {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const tenant = useTenantStore((s) => s.current);

  const nav: NavItem[] = [
    { label: 'My Children', path: '/parent', icon: DashboardIcon },
  ];

  return (
    <AppShell
      title={tenant?.name ?? 'Parent Portal'}
      subtitle="Parent Portal"
      nav={nav}
      onNavigateHome={() => navigate('/parent')}
      onLogout={async () => {
        useTenantStore.getState().clear();
        await logout();
        navigate('/login');
      }}
    >
      {user ? <Outlet /> : null}
    </AppShell>
  );
}
