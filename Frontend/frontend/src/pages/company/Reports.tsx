import { useState } from 'react'
import type { ReactElement, ReactNode } from 'react'
import { useQuery } from '@tanstack/react-query'
import dayjs from 'dayjs'
import { alpha } from '@mui/material/styles'
import {
  Alert,
  Avatar,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Grid,
  LinearProgress,
  MenuItem,
  Paper,
  Skeleton,
  Stack,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tabs,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material'
import AccessTimeIcon from '@mui/icons-material/AccessTime'
import ApartmentIcon from '@mui/icons-material/Apartment'
import AssessmentIcon from '@mui/icons-material/Assessment'
import CalendarTodayIcon from '@mui/icons-material/CalendarToday'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import DownloadIcon from '@mui/icons-material/Download'
import EventBusyIcon from '@mui/icons-material/EventBusy'
import Inventory2Icon from '@mui/icons-material/Inventory2'
import PeopleAltIcon from '@mui/icons-material/PeopleAlt'
import StorefrontIcon from '@mui/icons-material/Storefront'
import TrendingUpIcon from '@mui/icons-material/TrendingUp'
import WarningAmberIcon from '@mui/icons-material/WarningAmber'
import { reportsApi, downloadReportCsv, type AttendanceReport, type InventoryReport, type ReportKind, type StaffReport } from '../../api/reports'
import { branchesApi } from '../../api/branches'
import { departmentsApi } from '../../api/departments'
import { apiErrorMessage } from '../../api/client'
import { Can } from '../../components/PermissionGate'

const STATUS_TONE: Record<string, 'success' | 'error' | 'warning' | 'info' | 'secondary' | 'default'> = {
  ON_TIME: 'success',
  PRESENT: 'success',
  ABSENT: 'error',
  LATE: 'warning',
  EARLY_LEAVE: 'warning',
  OVERTIME: 'info',
  MISSED_CLOCK_IN: 'error',
  NO_CLOCK_OUT: 'secondary',
}

const REPORT_META: Record<ReportKind, { label: string; icon: ReactElement; description: string }> = {
  attendance: { label: 'Attendance', icon: <CalendarTodayIcon />, description: 'Clock-in and clock-out activity, presence and hours worked.' },
  staff: { label: 'Staff', icon: <PeopleAltIcon />, description: 'Workforce headcount, distribution and employment status.' },
  inventory: { label: 'Inventory', icon: <Inventory2Icon />, description: 'Stock levels, availability and low-stock alerts by branch.' },
}

export function ReportsPage() {
  const [kind, setKind] = useState<ReportKind>('attendance')
  const [branchFilter, setBranchFilter] = useState('')
  const [deptFilter, setDeptFilter] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [exporting, setExporting] = useState(false)
  const [exportError, setExportError] = useState('')

  const branches = useQuery({ queryKey: ['branches'], queryFn: () => branchesApi.list() })
  const departments = useQuery({ queryKey: ['departments'], queryFn: () => departmentsApi.list() })

  const attendance = useQuery({
    queryKey: ['report-attendance', branchFilter, from, to],
    queryFn: () => reportsApi.attendance({ branchId: branchFilter || undefined, from: from || undefined, to: to || undefined }),
    enabled: kind === 'attendance',
  })
  const staff = useQuery({
    queryKey: ['report-staff', branchFilter, deptFilter],
    queryFn: () => reportsApi.staff({ branchId: branchFilter || undefined, departmentId: deptFilter || undefined }),
    enabled: kind === 'staff',
  })
  const inventory = useQuery({
    queryKey: ['report-inventory', branchFilter],
    queryFn: () => reportsApi.inventory({ branchId: branchFilter || undefined }),
    enabled: kind === 'inventory',
  })

  const activeQuery =
    kind === 'attendance'
      ? { branchId: branchFilter || undefined, from: from || undefined, to: to || undefined }
      : kind === 'staff'
        ? { branchId: branchFilter || undefined, departmentId: deptFilter || undefined }
        : { branchId: branchFilter || undefined }

  const download = async () => {
    setExporting(true)
    setExportError('')
    try {
      await downloadReportCsv(kind, activeQuery)
    } catch (e) {
      setExportError(apiErrorMessage(e))
    } finally {
      setExporting(false)
    }
  }

  const disabled = exporting ||
    (kind === 'attendance' && attendance.isLoading) ||
    (kind === 'staff' && staff.isLoading) ||
    (kind === 'inventory' && inventory.isLoading)
  const isError =
    (kind === 'attendance' && attendance.isError) ||
    (kind === 'staff' && staff.isError) ||
    (kind === 'inventory' && inventory.isError)
  const error = attendance.isError ? attendance.error : staff.isError ? staff.error : inventory.error

  return (
    <Box>
      <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ xs: 'flex-start', sm: 'center' }} sx={{ mb: 3, gap: 2 }}>
        <Stack direction="row" alignItems="center" spacing={1.5}>
          <Avatar sx={{ width: 44, height: 44, bgcolor: alpha('#2563eb', 0.12), color: '#2563eb' }}>
            <AssessmentIcon />
          </Avatar>
          <Box>
            <Typography variant="h5" fontWeight={800} lineHeight={1.2}>Reports</Typography>
            <Typography variant="body2" color="text.secondary">
              {REPORT_META[kind].description}
            </Typography>
          </Box>
        </Stack>
        <Can permissions={['report.view']}>
          <Tooltip title="Download this report as a CSV file">
            <span>
              <Button variant="contained" startIcon={<DownloadIcon />} disabled={disabled} onClick={download}>
                {exporting ? 'Exporting…' : 'Export CSV'}
              </Button>
            </span>
          </Tooltip>
        </Can>
      </Stack>

      <Tabs
        value={kind}
        onChange={(_e, v) => { setKind(v as ReportKind); setDeptFilter('') }}
        variant="scrollable"
        allowScrollButtonsMobile
        sx={{ mb: 2, borderBottom: 1, borderColor: 'divider' }}
      >
        {(Object.keys(REPORT_META) as ReportKind[]).map((k) => (
          <Tab key={k} value={k} icon={REPORT_META[k].icon} iconPosition="start" label={REPORT_META[k].label} sx={{ textTransform: 'none', fontWeight: 700 }} />
        ))}
      </Tabs>

      <Paper variant="outlined" sx={{ p: 2, mb: 3 }}>
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} flexWrap="wrap" useFlexGap>
          <TextField select label="Branch" size="small" value={branchFilter} onChange={(e) => { setBranchFilter(e.target.value); setDeptFilter('') }} sx={{ minWidth: 220, width: { xs: '100%', sm: 'auto' } }}>
            <MenuItem value="">All branches</MenuItem>
            {(branches.data ?? []).map((b) => <MenuItem key={b.id} value={b.id}>{b.name}</MenuItem>)}
          </TextField>
          {kind === 'staff' && (
            <TextField select label="Department" size="small" value={deptFilter} onChange={(e) => setDeptFilter(e.target.value)} sx={{ minWidth: 220, width: { xs: '100%', sm: 'auto' } }}>
              <MenuItem value="">All departments</MenuItem>
              {(departments.data ?? []).map((d) => <MenuItem key={d.id} value={d.id}>{d.name}</MenuItem>)}
            </TextField>
          )}
          {kind === 'attendance' && (
            <>
              <TextField label="From" type="date" size="small" value={from} onChange={(e) => setFrom(e.target.value)} InputLabelProps={{ shrink: true }} sx={{ width: { xs: '100%', sm: 160 } }} />
              <TextField label="To" type="date" size="small" value={to} onChange={(e) => setTo(e.target.value)} InputLabelProps={{ shrink: true }} sx={{ width: { xs: '100%', sm: 160 } }} />
            </>
          )}
            <Stack direction="row" alignItems="center" spacing={0.5} sx={{ ml: { md: 'auto' }, width: { xs: '100%', md: 'auto' }, justifyContent: { xs: 'flex-start', md: 'flex-end' } }}>
            <AssessmentIcon sx={{ color: 'text.secondary', fontSize: 18 }} />
            <Typography variant="caption" color="text.secondary">
              Generated {dayjs().format('DD MMM YYYY · hh:mm A')}
            </Typography>
          </Stack>
        </Stack>
      </Paper>

      {(exportError || isError) && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={exportError ? () => setExportError('') : undefined}>
          {exportError || apiErrorMessage(error)}
        </Alert>
      )}

      {kind === 'attendance' && <AttendanceReport query={attendance} data={attendance.data} />}
      {kind === 'staff' && <StaffReport query={staff} data={staff.data} />}
      {kind === 'inventory' && <InventoryReport query={inventory} data={inventory.data} />}
    </Box>
  )
}

function KpiCard({ icon, tint, label, value, sub }: { icon: ReactNode; tint: string; label: string; value: ReactNode; sub?: ReactNode }) {
  return (
    <Card variant="outlined" sx={{ borderColor: 'divider', height: '100%' }}>
      <CardContent sx={{ p: 2.5, '&:last-child': { pb: 2.5 } }}>
        <Stack direction="row" alignItems="center" spacing={1.5}>
          <Avatar sx={{ width: 44, height: 44, bgcolor: alpha(tint, 0.14), color: tint }}>
            {icon}
          </Avatar>
          <Box sx={{ minWidth: 0 }}>
            <Typography variant="h5" fontWeight={800} lineHeight={1.1}>{value}</Typography>
            <Typography variant="caption" color="text.secondary" textTransform="uppercase" letterSpacing={0.6} noWrap>
              {label}
            </Typography>
          </Box>
        </Stack>
        {sub && <Box sx={{ mt: 1.5 }}>{sub}</Box>}
      </CardContent>
    </Card>
  )
}

function Distribution({ title, icon, color, data }: { title: string; icon?: ReactNode; color: string; data: Record<string, number> }) {
  const entries = Object.entries(data).sort((a, b) => b[1] - a[1])
  const max = Math.max(1, ...entries.map(([, v]) => v))
  return (
    <Card variant="outlined">
      <CardContent>
        <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1.5 }}>
          <Typography variant="subtitle2" fontWeight={700}>{title}</Typography>
          {icon}
        </Stack>
        {entries.length === 0 && <Typography variant="body2" color="text.secondary">No data for the selected filters.</Typography>}
        {entries.map(([k, v]) => (
          <Box key={k} sx={{ mb: 1.4 }}>
            <Stack direction="row" justifyContent="space-between" sx={{ mb: 0.4 }}>
              <Typography variant="body2" sx={{ textTransform: 'capitalize' }}>{k.replaceAll('_', ' ')}</Typography>
              <Typography variant="body2" fontWeight={700}>{v}</Typography>
            </Stack>
            <LinearProgress
              variant="determinate"
              value={(v / max) * 100}
              sx={{ height: 6, borderRadius: 3, bgcolor: alpha(color, 0.12), '& .MuiLinearProgress-bar': { bgcolor: color } }}
            />
          </Box>
        ))}
      </CardContent>
    </Card>
  )
}

function MostCommonStatus({ data }: { data: Record<string, number> }) {
  const entries = Object.entries(data)
  if (entries.length === 0) return null
  const [status, count] = entries.sort((a, b) => b[1] - a[1])[0]
  const total = entries.reduce((acc, [, v]) => acc + v, 0)
  const pct = total > 0 ? Math.round((count / total) * 100) : 0
  return (
    <Card variant="outlined">
      <CardContent>
        <Stack direction="row" alignItems="center" spacing={1}>
          <AssessmentIcon sx={{ color: 'text.secondary', fontSize: 18 }} />
          <Typography variant="subtitle2" fontWeight={700}>Most common status</Typography>
        </Stack>
        <Stack direction="row" alignItems="baseline" spacing={1} sx={{ mt: 1 }}>
          <Chip label={status.replaceAll('_', ' ')} size="small" color={STATUS_TONE[status] ?? 'default'} sx={{ textTransform: 'uppercase' }} />
          <Typography variant="h6" fontWeight={800}>{count}</Typography>
          <Typography variant="body2" color="text.secondary">({pct}% of records)</Typography>
        </Stack>
      </CardContent>
    </Card>
  )
}

function ReportTableHeader({ columns, count, loading }: { columns: string[]; count: number | undefined; loading: boolean }) {
  return (
    <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1.5 }}>
      <Typography variant="subtitle2" fontWeight={700} color="text.secondary">
        {columns.join(' · ')}
      </Typography>
      <Typography variant="caption" color="text.secondary">
        {loading ? 'Loading…' : `${count ?? 0} ${count === 1 ? 'record' : 'records'}`}
      </Typography>
    </Stack>
  )
}

function AttendanceReport({ query, data }: { query: { isLoading: boolean }; data: AttendanceReport | undefined }) {
  if (!data) {
    return (
      <Paper variant="outlined"><Stack spacing={1.5} sx={{ p: 3 }}><Skeleton /><Skeleton width="80%" /><Skeleton width="60%" /></Stack></Paper>
    )
  }
  const { summary, records } = data
  const byStatus = summary.byStatus ?? {}
  const presentRate = summary.totalRecords > 0 ? Math.round((summary.presentDays / summary.totalRecords) * 100) : 0
  return (
    <Box>
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={6} sm={4} lg={3}>
          <KpiCard icon={<CalendarTodayIcon />} tint="#2563eb" label="Total records" value={summary.totalRecords} />
        </Grid>
        <Grid item xs={6} sm={4} lg={3}>
          <KpiCard icon={<CheckCircleIcon />} tint="#16a34a" label="Present days" value={summary.presentDays} />
        </Grid>
        <Grid item xs={6} sm={4} lg={3}>
          <KpiCard icon={<EventBusyIcon />} tint="#dc2626" label="Absent days" value={summary.absentDays} />
        </Grid>
        <Grid item xs={6} sm={4} lg={3}>
          <KpiCard
            icon={<AccessTimeIcon />}
            tint="#7c3aed"
            label="Total hours"
            value={`${Math.round(summary.totalWorkHours * 10) / 10}h`}
          />
        </Grid>
        <Grid item xs={12}>
          <KpiCard
            icon={<TrendingUpIcon />}
            tint="#16a34a"
            label="Attendance rate"
            value={`${presentRate}%`}
            sub={
              <Box>
                <LinearProgress
                  variant="determinate"
                  value={presentRate}
                  sx={{ height: 8, borderRadius: 4, bgcolor: alpha('#16a34a', 0.12), '& .MuiLinearProgress-bar': { bgcolor: presentRate >= 80 ? '#16a34a' : presentRate >= 50 ? '#d97706' : '#dc2626' } }}
                />
                <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
                  {summary.presentDays} of {summary.totalRecords} attendance records were on time or present.
                </Typography>
              </Box>
            }
          />
        </Grid>
      </Grid>

      <Grid container spacing={2}>
        <Grid item xs={12} md={8}>
          <ReportTableHeader columns={['Date', 'Staff', 'Status']} count={records.length} loading={query.isLoading} />
          <TableContainer component={Paper} variant="outlined">
            <Table size="small">
              <TableHead>
                <TableRow sx={{ '& th': { bgcolor: 'action.hover', fontWeight: 700, whiteSpace: 'nowrap' } }}>
                  <TableCell>Date</TableCell>
                  <TableCell>Staff</TableCell>
                  <TableCell>Branch</TableCell>
                  <TableCell>Clock in</TableCell>
                  <TableCell>Clock out</TableCell>
                  <TableCell>Status</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {records.map((r) => (
                  <TableRow key={r.id} hover sx={{ '&:nth-of-type(even) td': { bgcolor: 'action.hover' } }}>
                    <TableCell sx={{ whiteSpace: 'nowrap' }}>{dayjs(r.date).format('DD MMM YYYY')}</TableCell>
                    <TableCell>{r.staffName ?? '—'}</TableCell>
                    <TableCell>{r.branchName ?? '—'}</TableCell>
                    <TableCell sx={{ whiteSpace: 'nowrap' }}>{r.clockInAt ? dayjs(r.clockInAt).format('hh:mm A') : '—'}</TableCell>
                    <TableCell sx={{ whiteSpace: 'nowrap' }}>{r.clockOutAt ? dayjs(r.clockOutAt).format('hh:mm A') : '—'}</TableCell>
                    <TableCell><Chip label={r.status} size="small" color={STATUS_TONE[r.status] ?? 'default'} /></TableCell>
                  </TableRow>
                ))}
                {records.length === 0 && <TableRow><TableCell colSpan={6} align="center" sx={{ py: 4, color: 'text.secondary' }}>No attendance records for the selected filters.</TableCell></TableRow>}
              </TableBody>
            </Table>
          </TableContainer>
        </Grid>
        <Grid item xs={12} md={4}>
          <Stack spacing={2}>
            <Distribution title="Status breakdown" icon={<CheckCircleIcon sx={{ color: 'text.secondary', fontSize: 18 }} />} color="#2563eb" data={byStatus} />
            <MostCommonStatus data={byStatus} />
          </Stack>
        </Grid>
      </Grid>
    </Box>
  )
}

function StaffReport({ query, data }: { query: { isLoading: boolean }; data: StaffReport | undefined }) {
  if (!data) {
    return (
      <Paper variant="outlined"><Stack spacing={1.5} sx={{ p: 3 }}><Skeleton /><Skeleton width="80%" /><Skeleton width="60%" /></Stack></Paper>
    )
  }
  const { summary, records } = data
  const activeRate = summary.totalStaff > 0 ? Math.round((summary.active / summary.totalStaff) * 100) : 0
  return (
    <Box>
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={6} sm={4} lg={4}>
          <KpiCard icon={<PeopleAltIcon />} tint="#2563eb" label="Total staff" value={summary.totalStaff} />
        </Grid>
        <Grid item xs={6} sm={4} lg={4}>
          <KpiCard icon={<CheckCircleIcon />} tint="#16a34a" label="Active" value={summary.active} sub={<LinearProgress variant="determinate" value={activeRate} sx={{ height: 6, borderRadius: 3, bgcolor: alpha('#16a34a', 0.12), '& .MuiLinearProgress-bar': { bgcolor: '#16a34a' } }} />} />
        </Grid>
        <Grid item xs={6} sm={4} lg={4}>
          <KpiCard icon={<EventBusyIcon />} tint="#dc2626" label="Inactive" value={summary.inactive} />
        </Grid>
      </Grid>

      <Grid container spacing={2}>
        <Grid item xs={12} md={8}>
          <ReportTableHeader columns={['Name', 'Branch', 'Department']} count={records.length} loading={query.isLoading} />
          <TableContainer component={Paper} variant="outlined">
            <Table size="small">
              <TableHead>
                <TableRow sx={{ '& th': { bgcolor: 'action.hover', fontWeight: 700, whiteSpace: 'nowrap' } }}>
                  <TableCell>Staff</TableCell>
                  <TableCell>Email</TableCell>
                  <TableCell>Branch</TableCell>
                  <TableCell>Department</TableCell>
                  <TableCell>Job title</TableCell>
                  <TableCell>Status</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {records.map((r) => (
                  <TableRow key={r.id} hover sx={{ '&:nth-of-type(even) td': { bgcolor: 'action.hover' } }}>
                    <TableCell>
                      <Typography fontWeight={600}>{r.name}</Typography>
                      {r.employeeCode && <Typography variant="caption" color="text.secondary">{r.employeeCode}</Typography>}
                    </TableCell>
                    <TableCell>{r.email}</TableCell>
                    <TableCell>{r.branchName ?? '—'}</TableCell>
                    <TableCell>{r.department ?? '—'}</TableCell>
                    <TableCell>{r.jobTitle ?? '—'}</TableCell>
                    <TableCell><Chip label={r.isActive ? 'Active' : 'Inactive'} size="small" color={r.isActive ? 'success' : 'default'} /></TableCell>
                  </TableRow>
                ))}
                {records.length === 0 && <TableRow><TableCell colSpan={6} align="center" sx={{ py: 4, color: 'text.secondary' }}>No staff for the selected filters.</TableCell></TableRow>}
              </TableBody>
            </Table>
          </TableContainer>
        </Grid>
        <Grid item xs={12} md={4}>
          <Stack spacing={2}>
            <Distribution title="By branch" icon={<StorefrontIcon sx={{ color: 'text.secondary', fontSize: 18 }} />} color="#2563eb" data={summary.byBranch} />
            <Distribution title="By department" icon={<ApartmentIcon sx={{ color: 'text.secondary', fontSize: 18 }} />} color="#7c3aed" data={summary.byDepartment} />
          </Stack>
        </Grid>
      </Grid>
    </Box>
  )
}

function InventoryReport({ query, data }: { query: { isLoading: boolean }; data: InventoryReport | undefined }) {
  if (!data) {
    return (
      <Paper variant="outlined"><Stack spacing={1.5} sx={{ p: 3 }}><Skeleton /><Skeleton width="80%" /><Skeleton width="60%" /></Stack></Paper>
    )
  }
  const { summary, items } = data
  const health = summary.totalItems > 0 ? Math.round(((summary.totalItems - summary.lowStockItems) / summary.totalItems) * 100) : 0
  return (
    <Box>
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={6} sm={4} lg={4}>
          <KpiCard icon={<Inventory2Icon />} tint="#2563eb" label="Total items" value={summary.totalItems} />
        </Grid>
        <Grid item xs={6} sm={4} lg={4}>
          <KpiCard icon={<WarningAmberIcon />} tint={summary.lowStockItems > 0 ? '#d97706' : '#16a34a'} label="Low stock" value={summary.lowStockItems} />
        </Grid>
        <Grid item xs={6} sm={4} lg={4}>
          <KpiCard
            icon={<TrendingUpIcon />}
            tint={health >= 80 ? '#16a34a' : '#d97706'}
            label="Stock health"
            value={`${health}%`}
            sub={<LinearProgress variant="determinate" value={health} sx={{ height: 6, borderRadius: 3, bgcolor: alpha('#16a34a', 0.12), '& .MuiLinearProgress-bar': { bgcolor: health >= 80 ? '#16a34a' : '#d97706' } }} />}
          />
        </Grid>
      </Grid>

      <Grid container spacing={2}>
        <Grid item xs={12} md={8}>
          <ReportTableHeader columns={['Item', 'SKU', 'Branch']} count={items.length} loading={query.isLoading} />
          <TableContainer component={Paper} variant="outlined">
            <Table size="small">
              <TableHead>
                <TableRow sx={{ '& th': { bgcolor: 'action.hover', fontWeight: 700, whiteSpace: 'nowrap' } }}>
                  <TableCell>Item</TableCell>
                  <TableCell>SKU</TableCell>
                  <TableCell>Branch</TableCell>
                  <TableCell>Quantity</TableCell>
                  <TableCell>Location</TableCell>
                  <TableCell>Status</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {items.map((r) => (
                  <TableRow key={r.id} hover sx={{ '&:nth-of-type(even) td': { bgcolor: 'action.hover' } }}>
                    <TableCell><Typography fontWeight={600}>{r.name}</Typography></TableCell>
                    <TableCell>{r.sku ?? '—'}</TableCell>
                    <TableCell>{r.branchName ?? '—'}</TableCell>
                    <TableCell>
                      <Typography fontWeight={600}>{r.quantity}</Typography>
                      <Typography variant="caption" color="text.secondary">{r.unit ?? ''}</Typography>
                    </TableCell>
                    <TableCell>{r.location ?? '—'}</TableCell>
                    <TableCell>
                      <Chip
                        label={r.isLowStock ? `Low stock · min ${r.minQuantity}` : 'In stock'}
                        size="small"
                        color={r.isLowStock ? 'error' : 'success'}
                      />
                    </TableCell>
                  </TableRow>
                ))}
                {items.length === 0 && <TableRow><TableCell colSpan={6} align="center" sx={{ py: 4, color: 'text.secondary' }}>No inventory for the selected filters.</TableCell></TableRow>}
              </TableBody>
            </Table>
          </TableContainer>
        </Grid>
        <Grid item xs={12} md={4}>
          <Stack spacing={2}>
            <Distribution title="Stock by branch" icon={<StorefrontIcon sx={{ color: 'text.secondary', fontSize: 18 }} />} color="#2563eb" data={summary.byBranch} />
            <Card variant="outlined" sx={{ borderColor: summary.lowStockItems > 0 ? '#f59e0b' : 'divider' }}>
              <CardContent>
                <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1 }}>
                  <WarningAmberIcon sx={{ color: summary.lowStockItems > 0 ? '#d97706' : '#16a34a' }} />
                  <Typography variant="subtitle2" fontWeight={700}>
                    {summary.lowStockItems > 0 ? 'Restock required' : 'All clear'}
                  </Typography>
                </Stack>
                <Typography variant="body2" color="text.secondary">
                  {summary.lowStockItems > 0
                    ? `${summary.lowStockItems} item${summary.lowStockItems === 1 ? '' : 's'} are at or below their minimum reorder level and need attention.`
                    : 'Every item is above its minimum reorder level. No restocking needed right now.'}
                </Typography>
              </CardContent>
            </Card>
          </Stack>
        </Grid>
      </Grid>
    </Box>
  )
}
