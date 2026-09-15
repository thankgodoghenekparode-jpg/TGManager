import { Outlet, useNavigate } from 'react-router-dom'
import DashboardIcon from '@mui/icons-material/Dashboard'
import ApartmentIcon from '@mui/icons-material/Apartment'
import WorkspacePremiumIcon from '@mui/icons-material/WorkspacePremium'
import PeopleIcon from '@mui/icons-material/People'
import SettingsIcon from '@mui/icons-material/Settings'
import FactCheckIcon from '@mui/icons-material/FactCheck'
import { AppShell, type NavItem } from './AppShell'
import { useAuthStore } from '../../store/auth'
import { isPlatformAdmin, useTenantStore } from '../../store/tenant'

const NAV: NavItem[] = [
  { label: 'Dashboard', path: '/admin', icon: DashboardIcon },
  { label: 'Tenants', path: '/admin/tenants', icon: ApartmentIcon },
  { label: 'Plans', path: '/admin/plans', icon: WorkspacePremiumIcon },
  { label: 'Users', path: '/admin/users', icon: PeopleIcon },
  { label: 'Account Requests', path: '/admin/account-requests', icon: FactCheckIcon },
  { label: 'Settings', path: '/admin/settings', icon: SettingsIcon },
]

export function PlatformLayout() {
  const navigate = useNavigate()
  const user = useAuthStore((s) => s.user)
  const logout = useAuthStore((s) => s.logout)

  return (
    <AppShell
      title="Zarox"
      subtitle="Platform Admin"
      nav={NAV}
      onNavigateHome={() => navigate('/admin')}
      onLogout={async () => {
        useTenantStore.getState().clear()
        await logout()
        navigate('/login')
      }}
    >
      {user && isPlatformAdmin(user.role) ? <Outlet /> : null}
    </AppShell>
  )
}
