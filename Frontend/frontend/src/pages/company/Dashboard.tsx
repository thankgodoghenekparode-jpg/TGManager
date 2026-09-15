import { useQuery } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import {
  Alert,
  Box,
  Card,
  CardContent,
  Chip,
  Grid,
  Link,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material'
import { Link as RouterLink } from 'react-router-dom'
import ApartmentIcon from '@mui/icons-material/Apartment'
import PeopleIcon from '@mui/icons-material/People'
import AccountTreeIcon from '@mui/icons-material/AccountTree'
import WarningAmberIcon from '@mui/icons-material/WarningAmber'
import TaskAltIcon from '@mui/icons-material/TaskAlt'
import WorkspacePremiumIcon from '@mui/icons-material/WorkspacePremium'
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth'
import { useTenantStore } from '../../store/tenant'
import { hasPermission } from '../../components/PermissionGate'
import { useAuthStore } from '../../store/auth'
import { branchesApi } from '../../api/branches'
import { staffApi } from '../../api/staff'
import { departmentsApi } from '../../api/departments'
import { inventoryApi } from '../../api/inventory'
import { reportsApi } from '../../api/reports'
import { notificationsApi } from '../../api/notifications'
import { workflowsApi } from '../../api/workflows'

export function CompanyDashboardPage() {
  const tenant = useTenantStore((s) => s.current)
  const role = useAuthStore((s) => s.user?.role)
  const canSubmitReports = hasPermission({
    role,
    isCompanyAdmin: tenant?.isCompanyAdmin ?? false,
    tenantPermissions: tenant?.permissions ?? [],
    required: ['report.submit'],
  })
  const branches = useQuery({ queryKey: ['branches'], queryFn: () => branchesApi.list() })
  const staff = useQuery({ queryKey: ['staff'], queryFn: () => staffApi.list() })
  const departments = useQuery({ queryKey: ['departments'], queryFn: () => departmentsApi.list() })
  const inventory = useQuery({ queryKey: ['inventory'], queryFn: () => inventoryApi.list() })
  const attendance = useQuery({ queryKey: ['report-attendance-dash'], queryFn: () => reportsApi.attendance() })
  const notifications = useQuery({ queryKey: ['notifications'], queryFn: () => notificationsApi.list(5) })
  const approvals = useQuery({ queryKey: ['wf-approvals'], queryFn: () => workflowsApi.approvals() })

  const staffData = staff.data ?? []
  const lowStock = (inventory.data ?? []).filter((i) => i.quantity <= i.minQuantity)

  return (
    <Box>
      {tenant?.onboardingStatus && tenant.onboardingStatus !== 'COMPLETED' && (
        <Alert severity="info" sx={{ mb: 3 }}>
          Onboarding in progress (stage: {tenant.onboardingStatus}).
        </Alert>
      )}
      <Typography variant="h5" fontWeight={800} gutterBottom>
        {tenant?.name ?? 'Company'} Dashboard
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3, marginTop: -1 }}>
        A quick pulse on your organisation
      </Typography>
      <Grid container spacing={2.5}>
        <Stat label="Branches" value={branches.data?.length ?? '—'} icon={<ApartmentIcon fontSize="small" />} tone="#4f46e5" />
        <Stat
          label="Staff"
          value={staffData.length}
          sub={`${staffData.filter((s) => s.isActive).length} active`}
          icon={<PeopleIcon fontSize="small" />}
          tone="#111827"
        />
        <Stat label="Departments" value={departments.data?.length ?? '—'} icon={<AccountTreeIcon fontSize="small" />} tone="#0891b2" />
        <Stat label="Low stock items" value={lowStock.length} warn={lowStock.length > 0} icon={<WarningAmberIcon fontSize="small" />} tone="#e11d48" />
        <Stat label="Pending approvals" value={approvals.data?.length ?? '—'} icon={<TaskAltIcon fontSize="small" />} tone="#d97706" />
        <Stat label="Plan" value={tenant?.plan?.name ?? '—'} icon={<WorkspacePremiumIcon fontSize="small" />} tone="#059669" />
      </Grid>

      {canSubmitReports && (
        <Grid container spacing={3} sx={{ mt: 1 }}>
          <Grid item xs={12}>
            <Card variant="outlined" sx={{ borderColor: 'rgba(37, 99, 235, 0.22)', background: 'linear-gradient(180deg, #ffffff 0%, #f4f8ff 100%)' }}>
              <CardContent sx={{ p: { xs: 2, sm: 2.5 } }}>
                <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={2} sx={{ flexWrap: 'wrap', gap: 1 }}>
                  <Stack direction="row" alignItems="center" spacing={1.5} sx={{ minWidth: 0 }}>
                    <Box
                      sx={{
                        width: 40,
                        height: 40,
                        borderRadius: 3,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: '#2563eb',
                        backgroundColor: '#2563eb18',
                      }}
                    >
                      <CalendarMonthIcon fontSize="small" />
                    </Box>
                    <Box>
                      <Typography variant="subtitle1" fontWeight={700}>Weekly report</Typography>
                      <Typography variant="body2" color="text.secondary">Submit or upload your report for the current week.</Typography>
                    </Box>
                  </Stack>
                  <Link component={RouterLink} to="/app/weekly-reports" variant="body1" fontWeight={600}>
                    Submit report
                  </Link>
                </Stack>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      )}

      <Grid container spacing={3} sx={{ mt: 1 }}>
        <Grid item xs={12} md={7}>
          <Card variant="outlined" sx={{ height: '100%' }}>
            <CardContent sx={{ p: { xs: 2, sm: 2.5 } }}>
                <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1, flexWrap: 'wrap', gap: 1 }}>
                <Typography variant="subtitle1" fontWeight={700}>Recent staff</Typography>
                <Link component={RouterLink} to="/app/staff" variant="body2">View all</Link>
              </Stack>
              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Name</TableCell>
                      <TableCell>Branch</TableCell>
                      <TableCell>Role</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {staffData.slice(0, 6).map((s) => (
                      <TableRow key={s.id} hover>
                        <TableCell>{s.user.firstName} {s.user.lastName}</TableCell>
                        <TableCell>{s.branch?.name ?? '—'}</TableCell>
                        <TableCell>{s.roles.map((r) => r.name).join(', ') || '—'}</TableCell>
                      </TableRow>
                    ))}
                    {staffData.length === 0 && (
                      <TableRow><TableCell colSpan={3} align="center">No staff yet</TableCell></TableRow>
                    )}
                  </TableBody>
                </Table>
              </TableContainer>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={5}>
          <Card variant="outlined" sx={{ mb: 3 }}>
            <CardContent sx={{ p: { xs: 2, sm: 2.5 } }}>
              <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 1 }}>
                Attendance today
              </Typography>
              {attendance.data && attendance.data.summary.totalRecords > 0 ? (
                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={3}>
                  <Box>
                    <Typography variant="h5" fontWeight={700}>{attendance.data.summary.presentDays}</Typography>
                    <Typography variant="body2" color="text.secondary">Present</Typography>
                  </Box>
                  <Box>
                    <Typography variant="h5" fontWeight={700}>{attendance.data.summary.absentDays}</Typography>
                    <Typography variant="body2" color="text.secondary">Absent</Typography>
                  </Box>
                  <Box>
                    <Typography variant="h5" fontWeight={700}>{Math.round(attendance.data.summary.totalWorkHours * 10) / 10}h</Typography>
                    <Typography variant="body2" color="text.secondary">Worked</Typography>
                  </Box>
                </Stack>
              ) : (
                <Typography variant="body2" color="text.secondary">No records yet.</Typography>
              )}
            </CardContent>
          </Card>

          <Card variant="outlined">
            <CardContent sx={{ p: { xs: 2, sm: 2.5 } }}>
              <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 1 }}>Notifications</Typography>
              {(notifications.data ?? []).slice(0, 4).map((n) => (
                <Box key={n.id} sx={{ py: 0.5, borderBottom: 1, borderColor: 'divider' }}>
                  <Stack direction="row" spacing={1} alignItems="center" sx={{ flexWrap: 'wrap' }}>
                    {!n.readAt && <Chip label="New" size="small" color="primary" />}
                    <Typography variant="body2" color="text.secondary">{n.body ?? n.title}</Typography>
                  </Stack>
                </Box>
              ))}
              {(notifications.data ?? []).length === 0 && (
                <Typography variant="body2" color="text.secondary">No notifications.</Typography>
              )}
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  )
}

function Stat({
  label,
  value,
  sub,
  warn,
  icon,
  tone,
}: {
  label: string
  value: number | string
  sub?: string
  warn?: boolean
  icon?: ReactNode
  tone?: string
}) {
  const color = warn ? '#e11d48' : tone
  return (
    <Grid item xs={12} sm={6} md={4} lg={2}>
      <Card variant="outlined" sx={{ height: '100%', transition: 'border-color .15s ease, box-shadow .15s ease', '&:hover': { borderColor: 'rgba(49, 87, 213, 0.35)', boxShadow: '0 10px 24px -18px rgba(49, 87, 213, 0.45)' } }}>
        <CardContent sx={{ p: { xs: 2, sm: 2.5 } }}>
          <Stack direction="row" alignItems="center" spacing={1.25} sx={{ mb: 1, flexWrap: 'wrap' }}>
            {icon && (
              <Box
                sx={{
                  width: 34,
                  height: 34,
                  borderRadius: 3,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color,
                  backgroundColor: `${color}18`,
                }}
              >
                {icon}
              </Box>
            )}
            <Typography color={warn ? 'error.main' : 'text.secondary'} variant="body2" fontWeight={600}>{label}</Typography>
          </Stack>
          <Typography variant="h4" fontWeight={800} color={warn ? 'error.main' : undefined} sx={{ lineHeight: 1.1 }}>
            {value}
          </Typography>
          {sub && <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>{sub}</Typography>}
        </CardContent>
      </Card>
    </Grid>
  )
}
