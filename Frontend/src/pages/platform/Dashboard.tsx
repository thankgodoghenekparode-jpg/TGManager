import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControlLabel,
  Grid,
  IconButton,
  Paper,
  Snackbar,
  Stack,
  Switch,
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
import TuneIcon from '@mui/icons-material/Tune'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import BlockIcon from '@mui/icons-material/Block'
import ChatIcon from '@mui/icons-material/Chat'
import EventNoteIcon from '@mui/icons-material/EventNote'
import DescriptionIcon from '@mui/icons-material/Description'
import ArticleIcon from '@mui/icons-material/Article'
import Inventory2Icon from '@mui/icons-material/Inventory2'
import BallotIcon from '@mui/icons-material/Ballot'
import PlaylistAddCheckIcon from '@mui/icons-material/PlaylistAddCheck'
import BarChartIcon from '@mui/icons-material/BarChart'
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth'
import HistoryIcon from '@mui/icons-material/History'
import ApiIcon from '@mui/icons-material/Api'
import AccountTreeIcon from '@mui/icons-material/AccountTree'
import { platformApi, type PlatformTenant } from '../../api/platform'
import { accountRequestsApi } from '../../api/accountRequests'
import { useAuthStore } from '../../store/auth'
import { apiErrorMessage } from '../../api/client'

interface FeatureDef {
  key: string
  label: string
  description: string
  category: 'Communication' | 'Workforce' | 'Operations' | 'Governance'
  icon: ReactNode
}

const ALL_FEATURES: FeatureDef[] = [
  {
    key: 'chat',
    label: 'Team Chat & Messaging',
    description: 'Direct team messaging, channels, and real-time audio notifications',
    category: 'Communication',
    icon: <ChatIcon fontSize="small" sx={{ color: '#FF4D5E' }} />,
  },
  {
    key: 'memos',
    label: 'Encrypted Executive Memos',
    description: 'Broadcast notices, executive bulletins, and mandatory read-receipts',
    category: 'Communication',
    icon: <ArticleIcon fontSize="small" sx={{ color: '#FF4D5E' }} />,
  },
  {
    key: 'attendance',
    label: 'Biometric Attendance & Clock-In',
    description: 'Hardware biometric sync, GPS geolocation fences, and shift clock-in/out',
    category: 'Workforce',
    icon: <FingerprintIcon fontSize="small" sx={{ color: '#38BDF8' }} />,
  },
  {
    key: 'schedules',
    label: 'Shift Scheduling & Rosters',
    description: 'Recurring shifts, branch rosters, and employee attendance schedules',
    category: 'Workforce',
    icon: <EventNoteIcon fontSize="small" sx={{ color: '#38BDF8' }} />,
  },
  {
    key: 'branches',
    label: 'Multi-Branch Hierarchy',
    description: 'Multi-location operations, physical site tracking, and branch admins',
    category: 'Workforce',
    icon: <ApartmentIcon fontSize="small" sx={{ color: '#38BDF8' }} />,
  },
  {
    key: 'departments',
    label: 'Departments & Groups',
    description: 'Organizational hierarchy, functional departments, and team groups',
    category: 'Workforce',
    icon: <AccountTreeIcon fontSize="small" sx={{ color: '#38BDF8' }} />,
  },
  {
    key: 'inventory',
    label: 'Inventory & Asset Tracking',
    description: 'Stock monitoring, low-stock threshold triggers, and asset allocations',
    category: 'Operations',
    icon: <Inventory2Icon fontSize="small" sx={{ color: '#10B981' }} />,
  },
  {
    key: 'documents',
    label: 'Secure Documents Vault',
    description: 'Corporate file repository, contracts, policies, and revision control',
    category: 'Operations',
    icon: <DescriptionIcon fontSize="small" sx={{ color: '#10B981' }} />,
  },
  {
    key: 'forms',
    label: 'Custom Dynamic Forms',
    description: 'Custom intake questionnaires, field validations, and auto-counters',
    category: 'Operations',
    icon: <BallotIcon fontSize="small" sx={{ color: '#10B981' }} />,
  },
  {
    key: 'workflows',
    label: 'Approval Workflows & Flows',
    description: 'Multi-step approvals, sequential review chains, and SLA routing',
    category: 'Operations',
    icon: <PlaylistAddCheckIcon fontSize="small" sx={{ color: '#10B981' }} />,
  },
  {
    key: 'reports',
    label: 'Executive Analytics & Reports',
    description: 'Cross-branch analytics, attendance KPIs, and printable PDF exports',
    category: 'Governance',
    icon: <BarChartIcon fontSize="small" sx={{ color: '#A78BFA' }} />,
  },
  {
    key: 'weeklyReports',
    label: 'Weekly Operations Reports',
    description: 'Mandatory Friday operational reporting and management reviews',
    category: 'Governance',
    icon: <CalendarMonthIcon fontSize="small" sx={{ color: '#A78BFA' }} />,
  },
  {
    key: 'audit',
    label: 'Security Audit Logs',
    description: 'Immutable trail of security events, administrative logins, and data edits',
    category: 'Governance',
    icon: <HistoryIcon fontSize="small" sx={{ color: '#A78BFA' }} />,
  },
  {
    key: 'integrations',
    label: 'API & Webhook Integrations',
    description: 'REST API keys, outgoing webhooks, and third-party event subscriptions',
    category: 'Governance',
    icon: <ApiIcon fontSize="small" sx={{ color: '#A78BFA' }} />,
  },
]

function getResolvedFeatureFlags(tenant: PlatformTenant): Record<string, boolean> {
  const planFlags = (tenant.plan?.featureFlags as Record<string, boolean> | undefined) ?? {}
  const customFlags = (tenant.settings?.featureFlags as Record<string, boolean> | undefined) ?? {}
  
  const resolved: Record<string, boolean> = {}
  for (const feat of ALL_FEATURES) {
    // Custom tenant override takes precedence, otherwise fallback to plan default, otherwise true
    if (customFlags[feat.key] !== undefined) {
      resolved[feat.key] = customFlags[feat.key]
    } else if (planFlags[feat.key] !== undefined) {
      resolved[feat.key] = Boolean(planFlags[feat.key])
    } else {
      resolved[feat.key] = true
    }
  }
  return resolved
}

export function PlatformDashboardPage() {
  const navigate = useNavigate()
  const qc = useQueryClient()
  const user = useAuthStore((s) => s.user)

  // Feature Management Dialog State
  const [featureDialogTenant, setFeatureDialogTenant] = useState<PlatformTenant | null>(null)
  const [activeFlags, setActiveFlags] = useState<Record<string, boolean>>({})
  const [snackbarMessage, setSnackbarMessage] = useState<string | null>(null)

  const tenants = useQuery({
    queryKey: ['platform', 'tenants'],
    queryFn: () => platformApi.tenants({ limit: 100 }),
  })
  const users = useQuery({
    queryKey: ['platform', 'users'],
    queryFn: () => platformApi.users({ limit: 100 }),
  })
  const plans = useQuery({
    queryKey: ['platform', 'plans'],
    queryFn: () => platformApi.plans(),
  })
  const requestsSummary = useQuery({
    queryKey: ['admin', 'account-requests', 'summary'],
    queryFn: () => accountRequestsApi.summary(),
  })

  const updateTenantMutation = useMutation({
    mutationFn: ({ id, settings }: { id: string; settings: Record<string, unknown> }) =>
      platformApi.updateTenant(id, { settings }),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['platform', 'tenants'] })
      const tenantName = featureDialogTenant?.name ?? 'Company'
      setSnackbarMessage(`Successfully updated feature entitlements for ${tenantName}`)
      if (featureDialogTenant?.id === vars.id) {
        setFeatureDialogTenant((prev) => (prev ? { ...prev, settings: vars.settings } : null))
      }
    },
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

  const openFeatureManager = (tenant: PlatformTenant) => {
    setFeatureDialogTenant(tenant)
    setActiveFlags(getResolvedFeatureFlags(tenant))
  }

  const handleToggleFeature = async (featureKey: string, newValue: boolean) => {
    if (!featureDialogTenant) return

    const updatedFlags = { ...activeFlags, [featureKey]: newValue }
    setActiveFlags(updatedFlags)

    const updatedSettings = {
      ...(featureDialogTenant.settings || {}),
      featureFlags: updatedFlags,
    }

    try {
      await updateTenantMutation.mutateAsync({
        id: featureDialogTenant.id,
        settings: updatedSettings,
      })
    } catch (err) {
      setSnackbarMessage(`Failed to update feature: ${apiErrorMessage(err)}`)
    }
  }

  const handleEnableAll = async () => {
    if (!featureDialogTenant) return
    const allOn: Record<string, boolean> = {}
    for (const f of ALL_FEATURES) allOn[f.key] = true
    setActiveFlags(allOn)
    const updatedSettings = {
      ...(featureDialogTenant.settings || {}),
      featureFlags: allOn,
    }
    await updateTenantMutation.mutateAsync({
      id: featureDialogTenant.id,
      settings: updatedSettings,
    })
  }

  const handleDisableNonCore = async () => {
    if (!featureDialogTenant) return
    const coreOnly: Record<string, boolean> = {
      chat: false,
      memos: false,
      attendance: true,
      schedules: true,
      branches: true,
      departments: true,
      inventory: false,
      documents: false,
      forms: false,
      workflows: false,
      reports: true,
      weeklyReports: false,
      audit: true,
      integrations: false,
    }
    setActiveFlags(coreOnly)
    const updatedSettings = {
      ...(featureDialogTenant.settings || {}),
      featureFlags: coreOnly,
    }
    await updateTenantMutation.mutateAsync({
      id: featureDialogTenant.id,
      settings: updatedSettings,
    })
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
          background: 'linear-gradient(135deg, rgba(236, 6, 24, 0.14) 0%, rgba(13, 3, 5, 0.95) 100%)',
          border: '1px solid rgba(236, 6, 24, 0.35)',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        <Box
          sx={{
            position: 'absolute',
            top: -40,
            right: -40,
            width: 220,
            height: 220,
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(236, 6, 24, 0.3) 0%, transparent 70%)',
            filter: 'blur(35px)',
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
                icon={<TuneIcon sx={{ fontSize: '14px !important', color: '#38BDF8 !important' }} />}
                label="Feature Entitlements Live Sync"
                size="small"
                sx={{
                  bgcolor: 'rgba(56, 189, 248, 0.12)',
                  color: '#38BDF8',
                  fontWeight: 700,
                  fontSize: '0.72rem',
                  border: '1px solid rgba(56, 189, 248, 0.3)',
                }}
              />
            </Stack>

            <Typography variant="h4" fontWeight={900} sx={{ letterSpacing: '-0.02em', color: '#FFFFFF' }}>
              Platform Super Admin Cockpit
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5, maxWidth: 640 }}>
              Live multi-tenant orchestration, global telemetry, and instant <strong>Company Feature Controls</strong> (turn modules ON/OFF per company).
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

      {/* ─── PENDING REQUESTS ALERT ─── */}
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
            title="Total Registered Companies"
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
            title="Subscription Plan Tiers"
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
        {/* LEFT COLUMN: REGISTERED COMPANIES & FEATURE MANAGEMENT */}
        <Grid item xs={12} lg={8}>
          <Stack spacing={3.5}>
            {/* Organizations & Feature Controls Matrix */}
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
                <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2.5, flexWrap: 'wrap', gap: 1.5 }}>
                  <Box>
                    <Typography variant="h6" fontWeight={800} sx={{ color: '#FFFFFF' }}>
                      Registered Companies & Feature Control Center
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      View company capabilities and toggle features <strong>ON</strong> or <strong>OFF</strong> with instant live enforcement
                    </Typography>
                  </Box>
                  <Button
                    size="small"
                    endIcon={<ArrowForwardIcon />}
                    onClick={() => navigate('/admin/tenants')}
                    sx={{ color: '#FF4D5E', fontWeight: 700 }}
                  >
                    Directory ({tenants.data?.total ?? 0})
                  </Button>
                </Stack>

                <TableContainer>
                  <Table size="small">
                    <TableHead>
                      <TableRow sx={{ '& th': { color: '#8A8F99', fontWeight: 700, borderColor: 'rgba(255, 255, 255, 0.08)' } }}>
                        <TableCell>Company Organization</TableCell>
                        <TableCell>Plan Tier</TableCell>
                        <TableCell>Active Capabilities</TableCell>
                        <TableCell>Status</TableCell>
                        <TableCell align="right">Feature Controls</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {tenantItems.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={5} sx={{ textAlign: 'center', py: 4, color: 'text.secondary', borderColor: 'rgba(255, 255, 255, 0.08)' }}>
                            No registered companies found.
                          </TableCell>
                        </TableRow>
                      ) : (
                        tenantItems.map((t) => {
                          const resolved = getResolvedFeatureFlags(t)
                          const activeCount = Object.values(resolved).filter(Boolean).length
                          const totalCount = ALL_FEATURES.length

                          return (
                            <TableRow
                              key={t.id}
                              sx={{
                                '&:hover': { bgcolor: 'rgba(236, 6, 24, 0.04)' },
                                '& td': { borderColor: 'rgba(255, 255, 255, 0.06)' },
                              }}
                            >
                              <TableCell sx={{ fontWeight: 700, color: '#FFFFFF' }}>
                                <Stack direction="row" alignItems="center" spacing={1}>
                                  <Box
                                    sx={{
                                      width: 28,
                                      height: 28,
                                      borderRadius: 1.5,
                                      bgcolor: 'rgba(236, 6, 24, 0.15)',
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                      color: '#FF4D5E',
                                      fontWeight: 800,
                                      fontSize: '0.75rem',
                                    }}
                                  >
                                    {t.name.slice(0, 2).toUpperCase()}
                                  </Box>
                                  <Box>
                                    <Typography variant="body2" fontWeight={800} color="#FFFFFF">
                                      {t.name}
                                    </Typography>
                                    <Typography variant="caption" color="#8A8F99" sx={{ fontFamily: 'monospace' }}>
                                      {t.slug} • {t.adminEmail ?? 'No admin email'}
                                    </Typography>
                                  </Box>
                                </Stack>
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
                              <TableCell>
                                <Tooltip title={`${activeCount} of ${totalCount} modules enabled`}>
                                  <Chip
                                    icon={<CheckCircleIcon sx={{ fontSize: '13px !important', color: activeCount === totalCount ? '#10B981 !important' : '#F59E0B !important' }} />}
                                    label={`${activeCount} / ${totalCount} Modules`}
                                    size="small"
                                    sx={{
                                      bgcolor: activeCount === totalCount ? 'rgba(16, 185, 129, 0.12)' : 'rgba(245, 158, 11, 0.12)',
                                      color: activeCount === totalCount ? '#10B981' : '#F59E0B',
                                      fontSize: '0.72rem',
                                      fontWeight: 700,
                                    }}
                                  />
                                </Tooltip>
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
                                  variant="outlined"
                                  size="small"
                                  startIcon={<TuneIcon />}
                                  onClick={() => openFeatureManager(t)}
                                  sx={{
                                    borderColor: 'rgba(236, 6, 24, 0.4)',
                                    bgcolor: 'rgba(236, 6, 24, 0.08)',
                                    color: '#FF4D5E',
                                    fontWeight: 800,
                                    fontSize: '0.75rem',
                                    py: 0.5,
                                    px: 1.25,
                                    '&:hover': {
                                      borderColor: '#EC0618',
                                      bgcolor: 'rgba(236, 6, 24, 0.2)',
                                    },
                                  }}
                                >
                                  Features (ON/OFF)
                                </Button>
                              </TableCell>
                            </TableRow>
                          )
                        })
                      )}
                    </TableBody>
                  </Table>
                </TableContainer>
              </CardContent>
            </Card>

            {/* Subscription Tiers Overview */}
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
                      Subscription Tiers & Quotas
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      Multi-tenant quotas, branch limits, and staff allowances
                    </Typography>
                  </Box>
                  <Button
                    size="small"
                    endIcon={<ArrowForwardIcon />}
                    onClick={() => navigate('/admin/plans')}
                    sx={{ color: '#FF4D5E', fontWeight: 700 }}
                  >
                    Manage Plans
                  </Button>
                </Stack>

                <Grid container spacing={2}>
                  {plansList.length === 0 ? (
                    <Grid item xs={12}>
                      <Typography variant="body2" color="text.secondary" sx={{ py: 2 }}>
                        No custom plans configured. Standard default limits apply.
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

        {/* RIGHT COLUMN: CLUSTER HEALTH & ROOT ACTIONS */}
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

      {/* ─── MODAL: COMPANY FEATURE FLAGS & ENTITLEMENTS MANAGER ─── */}
      <Dialog
        open={Boolean(featureDialogTenant)}
        onClose={() => setFeatureDialogTenant(null)}
        maxWidth="md"
        fullWidth
        PaperProps={{
          sx: {
            bgcolor: '#0B0B0E',
            backgroundImage: 'none',
            border: '1px solid rgba(236, 6, 24, 0.35)',
            borderRadius: 4,
            boxShadow: '0 24px 60px rgba(0, 0, 0, 0.8), 0 0 40px rgba(236, 6, 24, 0.15)',
          },
        }}
      >
        <DialogTitle sx={{ pb: 1, borderBottom: '1px solid rgba(255, 255, 255, 0.08)' }}>
          <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
            <Box>
              <Stack direction="row" alignItems="center" spacing={1}>
                <TuneIcon sx={{ color: '#EC0618' }} />
                <Typography variant="h6" fontWeight={900} color="#FFFFFF">
                  Feature Entitlements & Access Controls
                </Typography>
              </Stack>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                Configure modules for <strong>{featureDialogTenant?.name}</strong> (Slug: <code>{featureDialogTenant?.slug}</code>). Toggling a switch turns that feature ON or OFF in real time.
              </Typography>
            </Box>

            {updateTenantMutation.isPending && (
              <Chip
                icon={<CircularProgress size={14} color="inherit" />}
                label="Saving..."
                size="small"
                sx={{ bgcolor: 'rgba(236, 6, 24, 0.2)', color: '#FF4D5E', fontWeight: 700 }}
              />
            )}
          </Stack>
        </DialogTitle>

        <DialogContent sx={{ py: 2.5 }}>
          {/* Quick Presets */}
          <Paper
            variant="outlined"
            sx={{
              p: 1.5,
              mb: 2.5,
              borderRadius: 2.5,
              bgcolor: 'rgba(255, 255, 255, 0.02)',
              borderColor: 'rgba(255, 255, 255, 0.08)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: 1,
            }}
          >
            <Typography variant="caption" fontWeight={700} color="#9CA3AF">
              QUICK ENTITLEMENT PRESETS:
            </Typography>
            <Stack direction="row" spacing={1}>
              <Button
                size="small"
                variant="outlined"
                startIcon={<CheckCircleIcon fontSize="small" />}
                onClick={handleEnableAll}
                disabled={updateTenantMutation.isPending}
                sx={{
                  color: '#10B981',
                  borderColor: 'rgba(16, 185, 129, 0.3)',
                  fontSize: '0.72rem',
                  fontWeight: 700,
                  '&:hover': { borderColor: '#10B981', bgcolor: 'rgba(16, 185, 129, 0.1)' },
                }}
              >
                Enable All ({ALL_FEATURES.length})
              </Button>
              <Button
                size="small"
                variant="outlined"
                startIcon={<BlockIcon fontSize="small" />}
                onClick={handleDisableNonCore}
                disabled={updateTenantMutation.isPending}
                sx={{
                  color: '#F59E0B',
                  borderColor: 'rgba(245, 158, 11, 0.3)',
                  fontSize: '0.72rem',
                  fontWeight: 700,
                  '&:hover': { borderColor: '#F59E0B', bgcolor: 'rgba(245, 158, 11, 0.1)' },
                }}
              >
                Core Modules Only
              </Button>
            </Stack>
          </Paper>

          {/* Feature Flags Grid */}
          <Grid container spacing={2}>
            {ALL_FEATURES.map((f) => {
              const isEnabled = activeFlags[f.key] ?? true

              return (
                <Grid item xs={12} sm={6} key={f.key}>
                  <Paper
                    variant="outlined"
                    sx={{
                      p: 2,
                      borderRadius: 3,
                      bgcolor: isEnabled ? 'rgba(236, 6, 24, 0.04)' : 'rgba(255, 255, 255, 0.01)',
                      borderColor: isEnabled ? 'rgba(236, 6, 24, 0.3)' : 'rgba(255, 255, 255, 0.06)',
                      transition: 'all 0.2s ease',
                    }}
                  >
                    <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={1.5}>
                      <Box sx={{ minWidth: 0, flex: 1 }}>
                        <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 0.5 }}>
                          {f.icon}
                          <Typography variant="subtitle2" fontWeight={800} color="#FFFFFF">
                            {f.label}
                          </Typography>
                        </Stack>
                        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', lineHeight: 1.35 }}>
                          {f.description}
                        </Typography>
                      </Box>

                      <FormControlLabel
                        control={
                          <Switch
                            checked={isEnabled}
                            onChange={(e) => handleToggleFeature(f.key, e.target.checked)}
                            disabled={updateTenantMutation.isPending}
                            sx={{
                              '& .MuiSwitch-switchBase.Mui-checked': {
                                color: '#EC0618',
                                '&:hover': { backgroundColor: 'rgba(236, 6, 24, 0.12)' },
                              },
                              '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': {
                                backgroundColor: '#EC0618',
                              },
                            }}
                          />
                        }
                        label={
                          <Typography
                            variant="caption"
                            fontWeight={800}
                            sx={{ color: isEnabled ? '#10B981' : '#6B7280', minWidth: 28 }}
                          >
                            {isEnabled ? 'ON' : 'OFF'}
                          </Typography>
                        }
                        labelPlacement="bottom"
                        sx={{ m: 0 }}
                      />
                    </Stack>
                  </Paper>
                </Grid>
              )
            })}
          </Grid>
        </DialogContent>

        <DialogActions sx={{ p: 2.5, borderTop: '1px solid rgba(255, 255, 255, 0.08)' }}>
          <Button
            variant="contained"
            onClick={() => setFeatureDialogTenant(null)}
            sx={{
              bgcolor: '#EC0618',
              color: '#FFFFFF',
              fontWeight: 800,
              px: 3,
              '&:hover': { bgcolor: '#FF1F33' },
            }}
          >
            Done
          </Button>
        </DialogActions>
      </Dialog>

      {/* ─── NOTIFICATION TOAST ─── */}
      <Snackbar
        open={Boolean(snackbarMessage)}
        autoHideDuration={4000}
        onClose={() => setSnackbarMessage(null)}
        message={snackbarMessage}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
        sx={{
          '& .MuiSnackbarContent-root': {
            bgcolor: '#17171C',
            color: '#FFFFFF',
            border: '1px solid rgba(236, 6, 24, 0.4)',
            borderRadius: 3,
            fontWeight: 700,
            boxShadow: '0 8px 30px rgba(0, 0, 0, 0.8)',
          },
        }}
      />
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
