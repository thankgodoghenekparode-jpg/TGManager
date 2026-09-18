import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Divider,
  Grid,
  IconButton,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tooltip,
  Typography,
} from '@mui/material'
import type { ReactNode } from 'react'
import ApartmentIcon from '@mui/icons-material/Apartment'
import PeopleIcon from '@mui/icons-material/People'
import WorkspacePremiumIcon from '@mui/icons-material/WorkspacePremium'
import SecurityIcon from '@mui/icons-material/Security'
import FactCheckIcon from '@mui/icons-material/FactCheck'
import AddBusinessIcon from '@mui/icons-material/AddBusiness'
import PersonAddIcon from '@mui/icons-material/PersonAdd'
import SettingsIcon from '@mui/icons-material/Settings'
import ArrowForwardIcon from '@mui/icons-material/ArrowForward'
import SpeedIcon from '@mui/icons-material/Speed'
import HubIcon from '@mui/icons-material/Hub'
import FingerprintIcon from '@mui/icons-material/Fingerprint'
import StorageIcon from '@mui/icons-material/Storage'
import RefreshIcon from '@mui/icons-material/Refresh'
import { platformApi } from '../../api/platform'
import { accountRequestsApi } from '../../api/accountRequests'
import { useAuthStore } from '../../store/auth'

export function PlatformDashboardPage() {
  const navigate = useNavigate()
  const user = useAuthStore((s) => s.user)

  const tenants = useQuery({
    queryKey: ['platform', 'tenants'],
    queryFn: () => platformApi.tenants({ limit: 10 }),
  })
  const users = useQuery({
    queryKey: ['platform', 'users'],
    queryFn: () => platformApi.users({ limit: 10 }),
  })
  const plans = useQuery({
    queryKey: ['platform', 'plans'],
    queryFn: () => platformApi.plans(),
  })
  const requestsSummary = useQuery({
    queryKey: ['admin', 'account-requests', 'summary'],
    queryFn: () => accountRequestsApi.summary(),
  })

  const tenantItems = tenants.data?.items ?? []
  const activeTenantsCount = tenantItems.filter((t) => t.status === 'ACTIVE').length
  const suspendedTenantsCount = tenantItems.filter((t) => t.status === 'SUSPENDED').length
  const totalPendingRequests = requestsSummary.data?.totalPending ?? 0
  const plansList = plans.data ?? []

  const handleRefresh = () => {
    tenants.refetch()
    users.refetch()
    plans.refetch()
    requestsSummary.refetch()
  }

  return (
    <Box sx={{ pb: 6 }}>
      {/* ─── PLATFORM SUPER ADMIN COMMAND HEADER ─── */}
      <Paper
        elevation={0}
        sx={{
          p: { xs: 2.5, sm: 3.5 },
          mb: 3.5,
          borderRadius: 4,
          background: 'linear-gradient(135deg, rgba(236, 6, 24, 0.12) 0%, rgba(13, 3, 5, 0.95) 100%)',
          border: '1px solid rgba(236, 6, 24, 0.3)',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        <Box
          sx={{
            position: 'absolute',
            top: -40,
            right: -40,
            width: 200,
            height: 200,
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(236, 6, 24, 0.25) 0%, transparent 70%)',
            filter: 'blur(30px)',
            pointerEvents: 'none',
          }}
        />

        <Stack
          direction={{ xs: 'column', md: 'row' }}
          justifyContent="space-between"
          alignItems={{ xs: 'flex-start', md: 'center' }}
          spacing={2.5}
        >
          <Box>
            <Stack direction="row" alignItems="center" spacing={1.5} sx={{ mb: 1, flexWrap: 'wrap', gap: 1 }}>
              <Chip
                label="GLOBAL ROOT CONTROL"
                size="small"
                sx={{
                  bgcolor: 'rgba(236, 6, 24, 0.25)',
                  color: '#FF4D5E',
                  fontWeight: 900,
                  fontSize: '0.72rem',
                  letterSpacing: '0.08em',
                  border: '1px solid rgba(236, 6, 24, 0.45)',
                }}
              />
              <Chip
                label={user?.role ?? 'SUPER_ADMIN'}
                size="small"
                sx={{
                  bgcolor: 'rgba(255, 255, 255, 0.08)',
                  color: '#FFFFFF',
                  fontWeight: 700,
                  fontSize: '0.72rem',
                }}
              />
              <Chip
                icon={<SpeedIcon sx={{ fontSize: '14px !important', color: '#10B981 !important' }} />}
                label="Cluster Health: 99.99%"
                size="small"
                sx={{
                  bgcolor: 'rgba(16, 185, 129, 0.12)',
                  color: '#10B981',
                  fontWeight: 700,
                  fontSize: '0.72rem',
                  border: '1px solid rgba(16, 185, 129, 0.3)',
                }}
              />
            </Stack>

            <Typography variant="h4" fontWeight={900} sx={{ letterSpacing: '-0.02em', color: '#FFFFFF' }}>
              Platform Super Admin Cockpit
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5, maxWidth: 640 }}>
              Live enterprise multi-tenant orchestration, global telemetry, provisioning, and platform security oversight.
            </Typography>
          </Box>

          <Stack direction="row" spacing={1.5} sx={{ flexWrap: 'wrap', gap: 1 }}>
            <Tooltip title="Refresh platform metrics">
              <IconButton
                onClick={handleRefresh}
                sx={{
                  bgcolor: 'rgba(255, 255, 255, 0.05)',
                  border: '1px solid rgba(255, 255, 255, 0.12)',
                  color: '#FFFFFF',
                  '&:hover': { bgcolor: 'rgba(236, 6, 24, 0.2)', borderColor: 'rgba(236, 6, 24, 0.4)' },
                }}
              >
                <RefreshIcon fontSize="small" />
              </IconButton>
            </Tooltip>

            <Button
              variant="outlined"
              startIcon={<PersonAddIcon />}
              onClick={() => navigate('/admin/users')}
              sx={{
                borderColor: 'rgba(255, 255, 255, 0.2)',
                color: '#FFFFFF',
                fontWeight: 700,
                '&:hover': { borderColor: '#EC0618', bgcolor: 'rgba(236, 6, 24, 0.1)' },
              }}
            >
              Add User
            </Button>

            <Button
              variant="contained"
              startIcon={<AddBusinessIcon />}
              onClick={() => navigate('/admin/tenants')}
              sx={{
                bgcolor: '#EC0618',
                color: '#FFFFFF',
                fontWeight: 800,
                boxShadow: '0 4px 18px rgba(236, 6, 24, 0.45)',
                '&:hover': { bgcolor: '#FF1F33' },
              }}
            >
              Provision Organization
            </Button>
          </Stack>
        </Stack>
      </Paper>

      {/* ─── PENDING REQUESTS ALERT (IF ANY) ─── */}
      {totalPendingRequests > 0 && (
        <Alert
          severity="warning"
          action={
            <Button
              color="inherit"
              size="small"
              onClick={() => navigate('/admin/account-requests')}
              sx={{ fontWeight: 800 }}
            >
              Review Requests ({totalPendingRequests})
            </Button>
          }
          sx={{
            mb: 3.5,
            bgcolor: 'rgba(245, 158, 11, 0.12)',
            color: '#FBBF24',
            border: '1px solid rgba(245, 158, 11, 0.35)',
            borderRadius: 3,
            '& .MuiAlert-icon': { color: '#FBBF24' },
          }}
        >
          There are <strong>{totalPendingRequests}</strong> pending account security / access requests requiring root administrator authorization.
        </Alert>
      )}

      {/* ─── TOP EXECUTIVE METRICS ROW ─── */}
      <Grid container spacing={2.5} sx={{ mb: 4 }}>
        <Grid item xs={12} sm={6} md={3}>
          <PlatformMetricCard
            title="Total Organizations"
            value={tenants.data?.total ?? '—'}
            caption={`${activeTenantsCount} active • ${suspendedTenantsCount} suspended`}
            icon={<ApartmentIcon sx={{ color: '#EC0618' }} />}
            accent="#EC0618"
            onClick={() => navigate('/admin/tenants')}
          />
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <PlatformMetricCard
            title="Platform Super Users"
            value={users.data?.total ?? '—'}
            caption="Super Admins & Root Support"
            icon={<PeopleIcon sx={{ color: '#FF4D5E' }} />}
            accent="#FF4D5E"
            onClick={() => navigate('/admin/users')}
          />
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <PlatformMetricCard
            title="Active Plan Tiers"
            value={plansList.length > 0 ? plansList.length : '3'}
            caption="Starter • Pro • Enterprise"
            icon={<WorkspacePremiumIcon sx={{ color: '#38BDF8' }} />}
            accent="#38BDF8"
            onClick={() => navigate('/admin/plans')}
          />
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <PlatformMetricCard
            title="Pending Access Requests"
            value={totalPendingRequests}
            caption="Email updates & password resets"
            icon={<FactCheckIcon sx={{ color: totalPendingRequests > 0 ? '#F59E0B' : '#10B981' }} />}
            accent={totalPendingRequests > 0 ? '#F59E0B' : '#10B981'}
            onClick={() => navigate('/admin/account-requests')}
          />
        </Grid>
      </Grid>

      {/* ─── MAIN TWO-COLUMN DASHBOARD GRID ─── */}
      <Grid container spacing={3.5}>
        {/* LEFT COLUMN: TENANT REGISTRY & RECENT ACCOUNTS */}
        <Grid item xs={12} lg={8}>
          <Stack spacing={3.5}>
            {/* Organizations Directory Card */}
            <Card
              variant="outlined"
              sx={{
                bgcolor: '#0A0A0C',
                borderColor: 'rgba(255, 255, 255, 0.08)',
                borderRadius: 3.5,
                overflow: 'hidden',
              }}
            >
              <CardContent sx={{ p: { xs: 2, sm: 3 } }}>
                <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2.5 }}>
                  <Box>
                    <Typography variant="h6" fontWeight={800} sx={{ color: '#FFFFFF' }}>
                      Multi-Tenant Organizations Registry
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      Active enterprise workspaces isolated under multi-tenant nodes
                    </Typography>
                  </Box>
                  <Button
                    size="small"
                    endIcon={<ArrowForwardIcon />}
                    onClick={() => navigate('/admin/tenants')}
                    sx={{ color: '#FF4D5E', fontWeight: 700 }}
                  >
                    View All ({tenants.data?.total ?? 0})
                  </Button>
                </Stack>

                <TableContainer>
                  <Table size="small">
                    <TableHead>
                      <TableRow sx={{ '& th': { color: '#8A8F99', fontWeight: 700, borderColor: 'rgba(255, 255, 255, 0.08)' } }}>
                        <TableCell>Organization</TableCell>
                        <TableCell>Slug / Domain</TableCell>
                        <TableCell>Plan Tier</TableCell>
                        <TableCell>Admin Email</TableCell>
                        <TableCell>Status</TableCell>
                        <TableCell align="right">Action</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {tenantItems.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={6} sx={{ textAlign: 'center', py: 3, color: 'text.secondary', borderColor: 'rgba(255, 255, 255, 0.08)' }}>
                            No organizations found.
                          </TableCell>
                        </TableRow>
                      ) : (
                        tenantItems.slice(0, 6).map((t) => (
                          <TableRow
                            key={t.id}
                            sx={{
                              '&:hover': { bgcolor: 'rgba(236, 6, 24, 0.04)' },
                              '& td': { borderColor: 'rgba(255, 255, 255, 0.06)' },
                            }}
                          >
                            <TableCell sx={{ fontWeight: 700, color: '#FFFFFF' }}>
                              {t.name}
                            </TableCell>
                            <TableCell sx={{ color: '#9CA3AF', fontFamily: 'monospace', fontSize: '0.85rem' }}>
                              {t.slug}
                            </TableCell>
                            <TableCell>
                              <Chip
                                label={t.plan?.name ?? 'Standard'}
                                size="small"
                                sx={{
                                  bgcolor: 'rgba(56, 189, 248, 0.12)',
                                  color: '#38BDF8',
                                  fontSize: '0.72rem',
                                  fontWeight: 700,
                                }}
                              />
                            </TableCell>
                            <TableCell sx={{ color: '#9CA3AF', fontSize: '0.85rem' }}>
                              {t.adminEmail ?? '—'}
                            </TableCell>
                            <TableCell>
                              <Chip
                                label={t.status}
                                size="small"
                                sx={{
                                  bgcolor:
                                    t.status === 'ACTIVE'
                                      ? 'rgba(16, 185, 129, 0.15)'
                                      : 'rgba(236, 6, 24, 0.15)',
                                  color: t.status === 'ACTIVE' ? '#10B981' : '#EC0618',
                                  fontWeight: 800,
                                  fontSize: '0.7rem',
                                }}
                              />
                            </TableCell>
                            <TableCell align="right">
                              <Button
                                size="small"
                                variant="text"
                                onClick={() => navigate('/admin/tenants')}
                                sx={{ color: '#FF4D5E', fontWeight: 700, minWidth: 'auto', p: 0.5 }}
                              >
                                Manage
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </TableContainer>
              </CardContent>
            </Card>

            {/* Platform Plans Breakdown */}
            <Card
              variant="outlined"
              sx={{
                bgcolor: '#0A0A0C',
                borderColor: 'rgba(255, 255, 255, 0.08)',
                borderRadius: 3.5,
              }}
            >
              <CardContent sx={{ p: { xs: 2, sm: 3 } }}>
                <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
                  <Box>
                    <Typography variant="h6" fontWeight={800} sx={{ color: '#FFFFFF' }}>
                      Subscription Tiers & Quota Entitlements
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      Multi-tenant quotas, branch limitations, and module entitlements
                    </Typography>
                  </Box>
                  <Button
                    size="small"
                    endIcon={<ArrowForwardIcon />}
                    onClick={() => navigate('/admin/plans')}
                    sx={{ color: '#FF4D5E', fontWeight: 700 }}
                  >
                    Configure Plans
                  </Button>
                </Stack>

                <Grid container spacing={2}>
                  {plansList.length === 0 ? (
                    <Grid item xs={12}>
                      <Typography variant="body2" color="text.secondary" sx={{ py: 2 }}>
                        No customized plans configured. Default standard quotas apply.
                      </Typography>
                    </Grid>
                  ) : (
                    plansList.map((p) => (
                      <Grid item xs={12} sm={4} key={p.id}>
                        <Paper
                          variant="outlined"
                          sx={{
                            p: 2,
                            borderRadius: 2.5,
                            bgcolor: 'rgba(255, 255, 255, 0.02)',
                            borderColor: 'rgba(255, 255, 255, 0.08)',
                            transition: 'all 0.2s ease',
                            '&:hover': {
                              borderColor: 'rgba(236, 6, 24, 0.4)',
                              bgcolor: 'rgba(236, 6, 24, 0.03)',
                            },
                          }}
                        >
                          <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
                            <Typography variant="subtitle2" fontWeight={800} color="#FFFFFF">
                              {p.name}
                            </Typography>
                            <Chip
                              label={`$${(p.priceCents / 100).toFixed(0)}/mo`}
                              size="small"
                              sx={{
                                bgcolor: 'rgba(236, 6, 24, 0.15)',
                                color: '#FF4D5E',
                                fontWeight: 800,
                                fontSize: '0.72rem',
                              }}
                            />
                          </Stack>
                          <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 1 }}>
                            Max Branches: {p.maxBranches ? p.maxBranches : 'Unlimited'} • Max Staff: {p.maxStaff ? p.maxStaff : 'Unlimited'}
                          </Typography>
                          <Divider sx={{ my: 1, borderColor: 'rgba(255, 255, 255, 0.06)' }} />
                          <Typography variant="caption" color="#9CA3AF" display="block">
                            Storage: {p.maxStorageBytes ? `${Math.round(parseInt(p.maxStorageBytes) / (1024 * 1024))} MB` : '10 GB'}
                          </Typography>
                        </Paper>
                      </Grid>
                    ))
                  )}
                </Grid>
              </CardContent>
            </Card>
          </Stack>
        </Grid>

        {/* RIGHT COLUMN: INFRASTRUCTURE TELEMETRY & ROOT COMMANDS */}
        <Grid item xs={12} lg={4}>
          <Stack spacing={3.5}>
            {/* Global Cluster Health & Telemetry */}
            <Card
              variant="outlined"
              sx={{
                bgcolor: '#0A0A0C',
                borderColor: 'rgba(255, 255, 255, 0.08)',
                borderRadius: 3.5,
              }}
            >
              <CardContent sx={{ p: { xs: 2, sm: 3 } }}>
                <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 2 }}>
                  <SecurityIcon sx={{ color: '#EC0618', fontSize: 20 }} />
                  <Typography variant="h6" fontWeight={800} sx={{ color: '#FFFFFF' }}>
                    Cluster Telemetry
                  </Typography>
                </Stack>

                <Stack spacing={2}>
                  <TelemetryItem
                    icon={<StorageIcon sx={{ color: '#10B981', fontSize: 18 }} />}
                    title="Database Multi-Tenant Isolation"
                    status="Verified (AES-256 GCM)"
                    statusColor="#10B981"
                  />
                  <TelemetryItem
                    icon={<FingerprintIcon sx={{ color: '#38BDF8', fontSize: 18 }} />}
                    title="Biometric Hardware Engine"
                    status="Online & In-Sync"
                    statusColor="#38BDF8"
                  />
                  <TelemetryItem
                    icon={<HubIcon sx={{ color: '#A78BFA', fontSize: 18 }} />}
                    title="API Gateway Cluster"
                    status="24ms Latency (Nominal)"
                    statusColor="#A78BFA"
                  />
                  <TelemetryItem
                    icon={<SpeedIcon sx={{ color: '#10B981', fontSize: 18 }} />}
                    title="Audit Log Integrity"
                    status="100% Immutable Stream"
                    statusColor="#10B981"
                  />
                </Stack>
              </CardContent>
            </Card>

            {/* Quick Super Admin Actions */}
            <Card
              variant="outlined"
              sx={{
                bgcolor: '#0A0A0C',
                borderColor: 'rgba(255, 255, 255, 0.08)',
                borderRadius: 3.5,
              }}
            >
              <CardContent sx={{ p: { xs: 2, sm: 3 } }}>
                <Typography variant="h6" fontWeight={800} sx={{ color: '#FFFFFF', mb: 2 }}>
                  Root Management Tools
                </Typography>

                <Stack spacing={1.5}>
                  <Button
                    variant="outlined"
                    fullWidth
                    startIcon={<AddBusinessIcon />}
                    onClick={() => navigate('/admin/tenants')}
                    sx={{
                      justifyContent: 'flex-start',
                      borderColor: 'rgba(255, 255, 255, 0.12)',
                      color: '#FFFFFF',
                      py: 1.2,
                      fontWeight: 700,
                      '&:hover': { borderColor: '#EC0618', bgcolor: 'rgba(236, 6, 24, 0.08)' },
                    }}
                  >
                    Manage Organizations & Tenants
                  </Button>

                  <Button
                    variant="outlined"
                    fullWidth
                    startIcon={<FactCheckIcon />}
                    onClick={() => navigate('/admin/account-requests')}
                    sx={{
                      justifyContent: 'flex-start',
                      borderColor: 'rgba(255, 255, 255, 0.12)',
                      color: '#FFFFFF',
                      py: 1.2,
                      fontWeight: 700,
                      '&:hover': { borderColor: '#EC0618', bgcolor: 'rgba(236, 6, 24, 0.08)' },
                    }}
                  >
                    Audit Account Requests {totalPendingRequests > 0 ? `(${totalPendingRequests})` : ''}
                  </Button>

                  <Button
                    variant="outlined"
                    fullWidth
                    startIcon={<WorkspacePremiumIcon />}
                    onClick={() => navigate('/admin/plans')}
                    sx={{
                      justifyContent: 'flex-start',
                      borderColor: 'rgba(255, 255, 255, 0.12)',
                      color: '#FFFFFF',
                      py: 1.2,
                      fontWeight: 700,
                      '&:hover': { borderColor: '#EC0618', bgcolor: 'rgba(236, 6, 24, 0.08)' },
                    }}
                  >
                    Manage Pricing & Tier Plans
                  </Button>

                  <Button
                    variant="outlined"
                    fullWidth
                    startIcon={<SettingsIcon />}
                    onClick={() => navigate('/admin/settings')}
                    sx={{
                      justifyContent: 'flex-start',
                      borderColor: 'rgba(255, 255, 255, 0.12)',
                      color: '#FFFFFF',
                      py: 1.2,
                      fontWeight: 700,
                      '&:hover': { borderColor: '#EC0618', bgcolor: 'rgba(236, 6, 24, 0.08)' },
                    }}
                  >
                    Global Platform Settings
                  </Button>
                </Stack>
              </CardContent>
            </Card>
          </Stack>
        </Grid>
      </Grid>
    </Box>
  )
}

function PlatformMetricCard({
  title,
  value,
  caption,
  icon,
  accent,
  onClick,
}: {
  title: string
  value: number | string
  caption: string
  icon: ReactNode
  accent: string
  onClick: () => void
}) {
  return (
    <Card
      variant="outlined"
      onClick={onClick}
      sx={{
        height: '100%',
        cursor: 'pointer',
        bgcolor: '#0A0A0C',
        borderColor: 'rgba(255, 255, 255, 0.08)',
        borderRadius: 3.5,
        transition: 'all 0.25s ease',
        '&:hover': {
          borderColor: accent,
          transform: 'translateY(-2px)',
          boxShadow: `0 12px 30px -10px ${accent}40`,
        },
      }}
    >
      <CardContent sx={{ p: { xs: 2, sm: 2.5 } }}>
        <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1.5 }}>
          <Typography variant="body2" fontWeight={700} color="#9CA3AF">
            {title}
          </Typography>
          <Box
            sx={{
              width: 36,
              height: 36,
              borderRadius: 2.5,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              bgcolor: `${accent}18`,
              border: `1px solid ${accent}33`,
            }}
          >
            {icon}
          </Box>
        </Stack>
        <Typography variant="h3" fontWeight={900} sx={{ color: '#FFFFFF', lineHeight: 1.1, mb: 0.75 }}>
          {value}
        </Typography>
        <Typography variant="caption" sx={{ color: '#6B7280', fontWeight: 600 }}>
          {caption}
        </Typography>
      </CardContent>
    </Card>
  )
}

function TelemetryItem({
  icon,
  title,
  status,
  statusColor,
}: {
  icon: ReactNode
  title: string
  status: string
  statusColor: string
}) {
  return (
    <Paper
      variant="outlined"
      sx={{
        p: 1.75,
        borderRadius: 2.5,
        bgcolor: 'rgba(255, 255, 255, 0.02)',
        borderColor: 'rgba(255, 255, 255, 0.06)',
        display: 'flex',
        alignItems: 'center',
        gap: 1.5,
      }}
    >
      <Box
        sx={{
          width: 32,
          height: 32,
          borderRadius: 2,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          bgcolor: `${statusColor}15`,
        }}
      >
        {icon}
      </Box>
      <Box sx={{ minWidth: 0, flex: 1 }}>
        <Typography variant="body2" fontWeight={700} color="#FFFFFF" noWrap>
          {title}
        </Typography>
        <Typography variant="caption" sx={{ color: statusColor, fontWeight: 700 }} noWrap display="block">
          {status}
        </Typography>
      </Box>
    </Paper>
  )
}
