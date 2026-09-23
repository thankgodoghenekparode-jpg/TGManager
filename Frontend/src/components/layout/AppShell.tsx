import type { MouseEvent, ReactNode } from 'react'
import { useState } from 'react'
import { Link as RouterLink, useLocation, useNavigate } from 'react-router-dom'
import {
  AppBar,
  Avatar,
  Box,
  Divider,
  Drawer,
  IconButton,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
  Toolbar,
  Tooltip,
  Typography,
} from '@mui/material'
import MenuIcon from '@mui/icons-material/Menu'
import LogoutIcon from '@mui/icons-material/Logout'
import KeyIcon from '@mui/icons-material/Key'
import MailOutlineIcon from '@mui/icons-material/MailOutline'
import HistoryIcon from '@mui/icons-material/History'
import ArrowDropDownIcon from '@mui/icons-material/ArrowDropDown'
import DarkModeOutlinedIcon from '@mui/icons-material/DarkModeOutlined'
import LightModeOutlinedIcon from '@mui/icons-material/LightModeOutlined'
import type { SvgIconComponent } from '@mui/icons-material'
import { useAuthStore } from '../../store/auth'
import { useColorMode } from '../../contexts/ThemeContext'
import { NotificationsMenu } from '../NotificationsMenu'
import { ThemeToggle } from '../ThemeToggle'
import { ChangePasswordDialog } from '../account/ChangePasswordDialog'
import { Logo } from '../brand/Logo'
import { CallProvider } from '../chat/CallOverlay'

export interface NavItem {
  label: string
  path: string
  icon: SvgIconComponent
}

const DRAWER_WIDTH = 264

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  return parts
    .slice(0, 2)
    .map((p) => p[0])
    .join('')
    .toUpperCase() || '?'
}

export function AppShell({
  title,
  subtitle,
  nav,
  onNavigateHome,
  actions,
  children,
  onLogout,
}: {
  title: string
  subtitle?: string
  nav: NavItem[]
  onNavigateHome: () => void
  actions?: ReactNode
  children: ReactNode
  onLogout?: () => void
}) {
  const [open, setOpen] = useState(false)
  const [menuAnchor, setMenuAnchor] = useState<HTMLElement | null>(null)
  const [changePasswordOpen, setChangePasswordOpen] = useState(false)
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const user = useAuthStore((s) => s.user)

  const isPlatform =
    user?.role === 'SUPER_ADMIN' || user?.role === 'PLATFORM_SUPPORT'

  const drawer = (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <Box sx={{ px: 2.5, py: 2.75, display: 'flex', alignItems: 'center', gap: 1.5, cursor: 'pointer' }} onClick={onNavigateHome}>
        <Logo variant="mark" size={38} />
        <Box>
          <Typography variant="h6" sx={{ lineHeight: 1.1 }}>{title}</Typography>
          <Typography variant="caption" color="text.secondary" sx={{ letterSpacing: 0.4 }}>
            {subtitle ?? ''}
          </Typography>
        </Box>
      </Box>
      <Divider />
      <List sx={{ px: 1.25, py: 1.5, flex: 1, overflow: 'auto' }}>
        <Typography variant="caption" sx={{ px: 1, display: 'block', mb: 1, fontWeight: 700, letterSpacing: 1.5, color: 'text.secondary' }}>
          MENU
        </Typography>
        {nav.map((item) => {
          const active = pathname === item.path || (item.path !== '/' && pathname.startsWith(item.path))
          const Icon = item.icon
          return (
            <ListItemButton
              key={item.path}
              component={RouterLink}
              to={item.path}
              selected={active}
              onClick={() => setOpen(false)}
              sx={{ py: 1 }}
            >
              <ListItemIcon sx={{ minWidth: 38 }}>
                <Icon fontSize="small" />
              </ListItemIcon>
              <ListItemText primary={item.label} primaryTypographyProps={{ fontSize: 15, fontWeight: active ? 700 : 600 }} />
            </ListItemButton>
          )
        })}
      </List>
      {user && (
        <Box sx={{ m: 1.5, p: 1.25, borderRadius: 3, bgcolor: 'rgba(236, 6, 24, 0.08)', border: '1px solid rgba(236, 6, 24, 0.2)', display: 'flex', alignItems: 'center', gap: 1.25 }}>
          <Avatar sx={{ width: 34, height: 34, fontSize: 13 }}>{initials(`${user.firstName} ${user.lastName}`)}</Avatar>
          <Box sx={{ minWidth: 0, flex: 1 }}>
            <Typography variant="body2" fontWeight={700} noWrap>{user.firstName} {user.lastName}</Typography>
            <Typography variant="caption" color="text.secondary" noWrap display="block">{user.email}</Typography>
          </Box>
          {onLogout && (
            <Tooltip title="Logout">
              <IconButton size="small" onClick={onLogout}><LogoutIcon fontSize="small" /></IconButton>
            </Tooltip>
          )}
        </Box>
      )}
    </Box>
  )

  const handleMenuOpen = (e: MouseEvent<HTMLElement>) => setMenuAnchor(e.currentTarget)

  return (
    <Box sx={{ display: 'flex', minHeight: '100dvh', bgcolor: 'background.default' }}>
      <AppBar
        position="fixed"
        color="inherit"
        elevation={0}
        sx={{
          zIndex: (t) => t.zIndex.drawer + 1,
          borderBottom: '1px solid',
          borderColor: 'divider',
          boxShadow: '0 4px 18px -16px rgba(15, 23, 42, 0.4)',
        }}
      >
        <Toolbar
          sx={{
            gap: { xs: 1, sm: 1.5 },
            flexWrap: 'nowrap',
            minHeight: { xs: 56, sm: 64 },
            px: { xs: 1.25, sm: 2.5 },
          }}
        >
          <IconButton
            aria-label={open ? 'Close navigation' : 'Open navigation'}
            edge="start"
            color="inherit"
            onClick={() => setOpen(!open)}
            sx={{ mr: 0.5, display: { md: 'none' }, flexShrink: 0 }}
          >
            <MenuIcon />
          </IconButton>
          <Box
            sx={{
              flexGrow: 1,
              display: 'flex',
              alignItems: 'center',
              gap: 1.25,
              minWidth: 0,
              cursor: 'pointer',
            }}
            onClick={onNavigateHome}
          >
            <Logo variant="mark" size={32} />
            <Typography variant="subtitle1" noWrap sx={{ lineHeight: 1.1, fontWeight: 800, fontSize: { xs: '1.0625rem', sm: '1.25rem' } }}>
              {subtitle ?? title}
            </Typography>
          </Box>
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'flex-end',
              gap: { xs: 0.5, sm: 1 },
              flexShrink: 0,
            }}
          >
            <ThemeToggle />
            {user && <NotificationsMenu />}
            {actions}
            {user && (
              <Box
                onClick={handleMenuOpen}
                aria-label="Open account menu"
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 0.75,
                  py: 0.5,
                  pl: 0.5,
                  pr: { xs: 0.5, sm: 1 },
                  borderRadius: 999,
                  border: '1px solid',
                  borderColor: 'divider',
                  bgcolor: 'background.paper',
                  cursor: 'pointer',
                  '&:hover': { borderColor: 'rgba(236, 6, 24, 0.45)' },
                }}
              >
                <Avatar sx={{ width: 28, height: 28, fontSize: 11 }}>{initials(`${user.firstName} ${user.lastName}`)}</Avatar>
                <Box sx={{ display: { xs: 'none', sm: 'block' }, lineHeight: 1 }}>
                  <Typography variant="body2" fontWeight={700} noWrap>{user.firstName}</Typography>
                </Box>
                <ArrowDropDownIcon fontSize="small" sx={{ color: 'text.secondary', display: { xs: 'none', sm: 'block' } }} />
              </Box>
            )}
          </Box>
        </Toolbar>
      </AppBar>

      <Box component="nav" sx={{ width: { md: DRAWER_WIDTH }, flexShrink: { md: 0 } }}>
        <Drawer
          variant="temporary"
          open={open}
          onClose={() => setOpen(false)}
          ModalProps={{ keepMounted: true }}
          sx={{
            display: { xs: 'block', md: 'none' },
            '& .MuiDrawer-paper': {
              width: { xs: 'min(88vw, 320px)', sm: DRAWER_WIDTH },
              backgroundImage: 'none',
              pt: 'env(safe-area-inset-top, 0px)',
              pb: 'env(safe-area-inset-bottom, 0px)',
            },
          }}
        >
          {drawer}
        </Drawer>
        <Drawer
          variant="permanent"
          open
          sx={{
            display: { xs: 'none', md: 'block' },
            '& .MuiDrawer-paper': {
              width: DRAWER_WIDTH,
              backgroundImage: 'none',
              borderRight: '1px solid',
              borderColor: 'divider',
              pt: 'env(safe-area-inset-top, 0px)',
            },
          }}
        >
          {drawer}
        </Drawer>
      </Box>

      <Box component="main" sx={{ flexGrow: 1, width: { md: `calc(100% - ${DRAWER_WIDTH}px)` }, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        {/* Dynamic spacer matching fixed AppBar + iOS safe-area-inset-top */}
        <Box
          sx={{
            minHeight: {
              xs: 'calc(56px + env(safe-area-inset-top, 0px))',
              sm: 'calc(64px + env(safe-area-inset-top, 0px))',
            },
          }}
        />
        <Box
          key={pathname}
          className="app-page-enter"
          sx={{
            p: { xs: 1.5, sm: 2, md: 3.5 },
            pb: { xs: 'calc(24px + env(safe-area-inset-bottom, 0px))', sm: 3.5 },
            pl: { xs: 'calc(12px + env(safe-area-inset-left, 0px))', sm: 2, md: 3.5 },
            pr: { xs: 'calc(12px + env(safe-area-inset-right, 0px))', sm: 2, md: 3.5 },
            flex: 1,
            minWidth: 0,
            overflowX: 'hidden',
          }}
        >
          <CallProvider>{children}</CallProvider>
        </Box>
      </Box>

      <Menu
        anchorEl={menuAnchor}
        open={Boolean(menuAnchor)}
        onClose={() => setMenuAnchor(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
        slotProps={{ paper: { sx: { mt: 1, width: { xs: 'calc(100vw - 24px)', sm: 360 }, maxWidth: 'calc(100vw - 24px)', borderRadius: 3 } } }}
      >
        <Box sx={{ px: 2, py: 1 }}>
          <Typography variant="body2" fontWeight={700}>{user?.firstName} {user?.lastName}</Typography>
          <Typography variant="caption" color="text.secondary" noWrap display="block">{user?.email}</Typography>
        </Box>
        <Divider />
        <MenuItem onClick={() => { setMenuAnchor(null); setChangePasswordOpen(true) }}>
          <ListItemIcon sx={{ minWidth: 34 }}><KeyIcon fontSize="small" /></ListItemIcon>
          Change password
        </MenuItem>
        {!isPlatform && (
          <>
            <MenuItem onClick={() => { setMenuAnchor(null); navigate('/app/account/change-email') }}>
              <ListItemIcon sx={{ minWidth: 34 }}><MailOutlineIcon fontSize="small" /></ListItemIcon>
              Change email
            </MenuItem>
            <MenuItem onClick={() => { setMenuAnchor(null); navigate('/app/account/requests') }}>
              <ListItemIcon sx={{ minWidth: 34 }}><HistoryIcon fontSize="small" /></ListItemIcon>
              My requests
            </MenuItem>
          </>
        )}
        <Divider />
        <ThemeMenuItem onClose={() => setMenuAnchor(null)} />
        {onLogout && (
          <MenuItem onClick={onLogout} sx={{ color: 'error.main' }}>
            <ListItemIcon sx={{ minWidth: 34 }}><LogoutIcon fontSize="small" /></ListItemIcon>
            Logout
          </MenuItem>
        )}
      </Menu>
      <ChangePasswordDialog open={changePasswordOpen} onClose={() => setChangePasswordOpen(false)} />
    </Box>
  )
}

function ThemeMenuItem({ onClose }: { onClose: () => void }) {
  const { mode, toggleColorMode } = useColorMode()
  const isDark = mode === 'dark'

  return (
    <MenuItem
      onClick={() => {
        toggleColorMode()
        onClose()
      }}
    >
      <ListItemIcon sx={{ minWidth: 34 }}>
        {isDark ? (
          <LightModeOutlinedIcon fontSize="small" sx={{ color: '#FBBF24' }} />
        ) : (
          <DarkModeOutlinedIcon fontSize="small" />
        )}
      </ListItemIcon>
      {isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
    </MenuItem>
  )
}
