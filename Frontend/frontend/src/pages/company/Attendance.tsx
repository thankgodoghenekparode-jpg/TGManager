import { useMemo, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
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
  Grid,
  MenuItem,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material'
import LoginIcon from '@mui/icons-material/Login'
import LogoutIcon from '@mui/icons-material/Logout'
import LocationOnIcon from '@mui/icons-material/LocationOn'
import {
  attendanceApi,
  type AttendanceRecord,
  type AttendanceStatus,
} from '../../api/attendance'
import { branchesApi } from '../../api/branches'
import { staffApi } from '../../api/staff'
import { apiErrorMessage } from '../../api/client'
import { Can } from '../../components/PermissionGate'
import { distanceMeters, getCurrentPosition, type GeoPosition, type GeoStatus } from '../../lib/geo'

const STATUS_COLORS: Record<AttendanceStatus, 'success' | 'warning' | 'error' | 'info' | 'default'> = {
  ON_TIME: 'success',
  LATE: 'warning',
  EARLY_LEAVE: 'warning',
  OVERTIME: 'info',
  MISSED_CLOCK_IN: 'error',
  NO_CLOCK_OUT: 'error',
  ABSENT: 'default',
}

type PeriodKey = 'all' | 'today' | 'yesterday' | 'last7' | 'thisWeek' | 'lastWeek' | 'thisMonth' | 'lastMonth'

const PERIOD_OPTIONS: Array<{ value: PeriodKey; label: string }> = [
  { value: 'all', label: 'All time' },
  { value: 'today', label: 'Today' },
  { value: 'yesterday', label: 'Yesterday' },
  { value: 'last7', label: 'Last 7 days' },
  { value: 'thisWeek', label: 'This week' },
  { value: 'lastWeek', label: 'Last week' },
  { value: 'thisMonth', label: 'This month' },
  { value: 'lastMonth', label: 'Last month' },
]

function pad2(n: number): string {
  return String(n).padStart(2, '0')
}

function lagosDateKey(d: Date): string {
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Africa/Lagos',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
  const p: Record<string, string> = {}
  for (const part of fmt.formatToParts(d)) p[part.type] = part.value
  return `${p.year}-${p.month}-${p.day}`
}

function shiftKey(key: string, days: number): string {
  const [y, m, d] = key.split('-').map(Number)
  return lagosDateKey(new Date(Date.UTC(y, m - 1, d + days)))
}

function weekdayOfKey(key: string): number {
  const [y, m, d] = key.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay()
}

function monthRange(key: string): { from: string; to: string } {
  const [y, m] = key.split('-').map(Number)
  const daysInMonth = new Date(Date.UTC(y, m, 0)).getUTCDate()
  return { from: `${y}-${pad2(m)}-01`, to: `${y}-${pad2(m)}-${pad2(daysInMonth)}` }
}

function attendancePeriodRange(period: PeriodKey): { from?: string; to?: string } {
  const today = lagosDateKey(new Date())
  if (period === 'all') return {}
  if (period === 'today') return { from: today, to: today }
  if (period === 'yesterday') {
    const f = shiftKey(today, -1)
    return { from: f, to: f }
  }
  if (period === 'last7') return { from: shiftKey(today, -6), to: today }
  const daysSinceMonday = (weekdayOfKey(today) + 6) % 7
  const monday = shiftKey(today, -daysSinceMonday)
  if (period === 'thisWeek') return { from: monday, to: shiftKey(monday, 6) }
  if (period === 'lastWeek') {
    const m = shiftKey(monday, -7)
    return { from: m, to: shiftKey(m, 6) }
  }
  const [y, m] = today.split('-').map(Number)
  let ty = y
  let tm = m
  if (period === 'lastMonth') {
    tm = m - 1
    if (tm === 0) {
      ty = y - 1
      tm = 12
    }
  }
  return monthRange(`${ty}-${pad2(tm)}-01`)
}

export function AttendancePage() {
  const qc = useQueryClient()
  const [branchId, setBranchId] = useState('')
  const [staffRecordId, setStaffRecordId] = useState('')
  const [status, setStatus] = useState('')
  const [period, setPeriod] = useState<PeriodKey>('all')
  const [clockDialog, setClockDialog] = useState<'in' | 'out' | null>(null)
  const [clockResult, setClockResult] = useState<AttendanceRecord | null>(null)
  const [clockKind, setClockKind] = useState<'in' | 'out' | null>(null)

  const range = useMemo(() => attendancePeriodRange(period), [period])

  const branches = useQuery({ queryKey: ['branches'], queryFn: () => branchesApi.list() })
  const staff = useQuery({ queryKey: ['staff'], queryFn: () => staffApi.list() })
  const records = useQuery({
    queryKey: ['attendance', branchId, staffRecordId, status, range.from, range.to],
    queryFn: () => attendanceApi.list({
      branchId: branchId || undefined,
      staffRecordId: staffRecordId || undefined,
      status: (status as AttendanceStatus) || undefined,
      from: range.from,
      to: range.to,
    }),
  })
  const summary = useQuery({
    queryKey: ['attendance-summary', branchId, range.from, range.to],
    queryFn: () => attendanceApi.summary({ branchId: branchId || undefined, from: range.from, to: range.to }),
  })

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['attendance'] })
    qc.invalidateQueries({ queryKey: ['attendance-summary'] })
  }

  const clock = useMutation({
    mutationFn: ({ kind, position }: { kind: 'in' | 'out'; position: GeoPosition }) =>
      kind === 'in'
        ? attendanceApi.clockIn({ latitude: position.latitude, longitude: position.longitude })
        : attendanceApi.clockOut({ latitude: position.latitude, longitude: position.longitude }),
    onSuccess: (data, vars) => {
      setClockDialog(null)
      setClockResult(data)
      setClockKind(vars.kind)
      invalidate()
    },
  })

  const rows = records.data ?? []
  const sum = summary.data

  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2, flexWrap: 'wrap', gap: 1 }}>
        <Typography variant="h5" fontWeight={700}>Attendance</Typography>
        <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap' }}>
          <Can permissions={['attendance.clock_in']}>
            <Button variant="contained" startIcon={<LoginIcon />} onClick={() => setClockDialog('in')}>Clock in</Button>
          </Can>
          <Can permissions={['attendance.clock_out']}>
            <Button variant="outlined" startIcon={<LogoutIcon />} onClick={() => setClockDialog('out')}>Clock out</Button>
          </Can>
        </Stack>
      </Stack>

      {clock.error && <Alert severity="error" sx={{ mb: 2 }}>{apiErrorMessage(clock.error)}</Alert>}
      {clockResult && clockKind && (
        <Alert severity={clockSeverity(clockResult, clockKind)} sx={{ mb: 2 }} onClose={() => setClockResult(null)}>
          {clockResultSummary(clockResult, clockKind)}
        </Alert>
      )}

      <Grid container spacing={2} sx={{ mb: 2 }}>
        <Stat label="Total" value={sum?.total ?? '—'} />
        <Stat label="Present" value={sum?.present ?? '—'} />
        {Object.entries(sum?.byStatus ?? {}).map(([k, v]) => (
          <Stat key={k} label={k.replaceAll('_', ' ')} value={v ?? 0} />
        ))}
      </Grid>

      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ mb: 2 }}>
        <TextField select label="Period" size="small" value={period} onChange={(e) => setPeriod(e.target.value as PeriodKey)} sx={{ minWidth: 170, width: { xs: '100%', sm: 'auto' } }}>
          {PERIOD_OPTIONS.map((o) => <MenuItem key={o.value} value={o.value}>{o.label}</MenuItem>)}
        </TextField>
        <TextField select label="Branch" size="small" value={branchId} onChange={(e) => setBranchId(e.target.value)} sx={{ minWidth: 200, width: { xs: '100%', sm: 'auto' } }}>
          <MenuItem value="">All branches</MenuItem>
          {(branches.data ?? []).map((b) => <MenuItem key={b.id} value={b.id}>{b.name}</MenuItem>)}
        </TextField>
        <Can permissions={['attendance.manage']}>
          <TextField select label="Staff" size="small" value={staffRecordId} onChange={(e) => setStaffRecordId(e.target.value)} sx={{ minWidth: 220, width: { xs: '100%', sm: 'auto' } }}>
            <MenuItem value="">All staff</MenuItem>
            {(staff.data ?? []).map((s) => (
              <MenuItem key={s.id} value={s.id}>{s.user.firstName} {s.user.lastName}</MenuItem>
            ))}
          </TextField>
        </Can>
        <TextField select label="Status" size="small" value={status} onChange={(e) => setStatus(e.target.value)} sx={{ minWidth: 180, width: { xs: '100%', sm: 'auto' } }}>
          <MenuItem value="">All statuses</MenuItem>
          {Object.keys(STATUS_COLORS).map((s) => <MenuItem key={s} value={s}>{s.replaceAll('_', ' ')}</MenuItem>)}
        </TextField>
      </Stack>

      <TableContainer component={Paper} variant="outlined">
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Staff</TableCell>
              <TableCell>Branch</TableCell>
              <TableCell>Date</TableCell>
              <TableCell>Clock in</TableCell>
              <TableCell>Clock out</TableCell>
              <TableCell>Clock-in status</TableCell>
              <TableCell>Clock-out status</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.map((r) => (
              <TableRow key={r.id} hover>
                <TableCell>{r.user ? `${r.user.firstName} ${r.user.lastName}` : r.userId}</TableCell>
                <TableCell>{r.branch?.name ?? '—'}</TableCell>
                <TableCell>{formatDate(r.date)}</TableCell>
                <TableCell>{r.clockInAt ? <TimeCell iso={r.clockInAt} caption={lateCaption(r.lateMinutes)} tone="error" /> : '—'}</TableCell>
                <TableCell>{r.clockOutAt ? <ClockOutCell iso={r.clockOutAt} record={r} /> : '—'}</TableCell>
                <TableCell><Chip label={clockInStatus(r).label} size="small" color={clockInStatus(r).color} /></TableCell>
                <TableCell>{r.clockOutAt ? <Chip label={clockOutStatus(r).label} size="small" color={clockOutStatus(r).color} /> : '—'}</TableCell>
              </TableRow>
            ))}
            {rows.length === 0 && <TableRow><TableCell colSpan={7} align="center">No attendance records</TableCell></TableRow>}
          </TableBody>
        </Table>
      </TableContainer>

      {clockDialog && (
        <ClockDialog
          kind={clockDialog}
          branches={branches.data ?? []}
          onCancel={() => setClockDialog(null)}
          onConfirm={(position) => clock.mutate({ kind: clockDialog, position })}
          busy={clock.isPending}
        />
      )}
    </Box>
  )
}

function ClockDialog({
  kind,
  branches,
  onCancel,
  onConfirm,
  busy,
}: {
  kind: 'in' | 'out'
  branches: Array<{ id: string; name: string; latitude: number; longitude: number; radiusMeters: number | null }>
  onCancel: () => void
  onConfirm: (position: GeoPosition) => void
  busy: boolean
}) {
  const [position, setPosition] = useState<GeoPosition | null>(null)
  const [geoStatus, setGeoStatus] = useState<GeoStatus>('idle')
  const [message, setMessage] = useState('')
  const [branchId, setBranchId] = useState('')
  const [error, setError] = useState('')

  const active = useRef(false)

  const refresh = async () => {
    active.current = true
    setGeoStatus('loading')
    setError('')
    setMessage('')
    const { position: pos, status } = await getCurrentPosition()
    if (!active.current) return
    setGeoStatus(status)
    if (pos) {
      setPosition(pos)
      setMessage(`Your current location: ${pos.latitude.toFixed(6)}, ${pos.longitude.toFixed(6)}`)
    } else if (status === 'denied') {
      setError('Location permission was denied. Enable location access in your browser to clock in/out.')
    } else {
      setError('Unable to determine your location. Check that location services are enabled and try again.')
    }
  }

  const refBranch = branches.find((b) => b.id === branchId) ?? branches[0] ?? null
  const refLat = refBranch?.latitude ?? 5.564747
  const refLng = refBranch?.longitude ?? 5.815643
  const refRadius = refBranch?.radiusMeters ?? 200
  const within = position ? distanceMeters(refLat, refLng, position.latitude, position.longitude) <= refRadius : false

  return (
    <Dialog open onClose={onCancel} fullWidth maxWidth="xs">
      <DialogTitle>Clock {kind === 'in' ? 'in' : 'out'}</DialogTitle>
      <DialogContent sx={{ px: { xs: 2, sm: 3 }, pt: { xs: 1.5, sm: 2 } }}>
        <Stack spacing={2} sx={{ pt: 1, minWidth: { xs: 'auto', sm: 320 } }}>
          <Alert severity="info">
            Your browser location will be used to verify you are at the branch.
            {geoStatus === 'loading' && ' Locating…'}
          </Alert>
          {branches.length > 0 && (
            <TextField select label="Check-in location" size="small" value={branchId} onChange={(e) => setBranchId(e.target.value)}>
              <MenuItem value=""><em>Default (company HQ)</em></MenuItem>
              {branches.map((b) => <MenuItem key={b.id} value={b.id}>{b.name}</MenuItem>)}
            </TextField>
          )}
          {position && (
            <Stack direction="row" alignItems="center" spacing={1}>
              <LocationOnIcon color={within ? 'success' : 'error'} />
              <Typography variant="body2" color="text.secondary">
                {message} · {Math.round(distanceMeters(refLat, refLng, position.latitude, position.longitude))}m from {refBranch?.name ?? 'company HQ'}
              </Typography>
            </Stack>
          )}
          {!position && geoStatus !== 'loading' && (
            <Typography variant="body2" color="text.secondary">
              Location not captured yet. Tap “Use my location”.
            </Typography>
          )}
          {error && <Alert severity="warning">{error}</Alert>}
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: { xs: 2, sm: 3 }, pb: { xs: 2, sm: 2 }, flexWrap: 'wrap' }}>
        <Button onClick={onCancel} disabled={busy}>Cancel</Button>
        <Button onClick={() => void refresh()} disabled={busy || geoStatus === 'loading'}>
          {geoStatus === 'loading' ? <CircularProgress size={18} /> : 'Use my location'}
        </Button>
        <Button
          variant="contained"
          color={kind === 'out' ? 'warning' : 'primary'}
          disabled={busy || !position || !within}
          onClick={() => position && onConfirm(position)}
        >
          Confirm
        </Button>
      </DialogActions>
    </Dialog>
  )
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <Grid item xs={6} sm={4} md={3}>
      <Card variant="outlined">
        <CardContent sx={{ py: 1.5 }}>
          <Typography color="text.secondary" variant="caption" textTransform="uppercase">{label}</Typography>
          <Typography variant="h5" fontWeight={700}>{value}</Typography>
        </CardContent>
      </Card>
    </Grid>
  )
}

function formatDate(iso: string): string {
  return new Intl.DateTimeFormat(undefined, {
    timeZone: 'Africa/Lagos',
    year: 'numeric',
    month: 'short',
    day: '2-digit',
  }).format(new Date(iso))
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

function lateCaption(lateMinutes: number | null): string | null {
  if (lateMinutes == null || lateMinutes <= 0) return null
  return `${lateMinutes} min late`
}

type StatusChip = { label: string; color: 'success' | 'warning' | 'error' | 'info' | 'default' }

function clockInStatus(r: AttendanceRecord): StatusChip {
  if (!r.clockInAt) {
    return { label: r.status.replaceAll('_', ' '), color: STATUS_COLORS[r.status] }
  }
  if (r.lateMinutes != null && r.lateMinutes > 0) {
    return { label: 'Late', color: 'warning' }
  }
  return { label: 'On time', color: 'success' }
}

function clockOutStatus(r: AttendanceRecord): StatusChip {
  if (r.status === 'EARLY_LEAVE') return { label: 'Early leave', color: 'warning' }
  if (r.status === 'OVERTIME') return { label: 'Overtime', color: 'info' }
  return { label: 'On time', color: 'success' }
}

type CaptionTone = 'error' | 'warning' | 'info'

function clockOutCaption(r: AttendanceRecord): { text: string; tone: CaptionTone } | null {
  if (r.status === 'EARLY_LEAVE' && r.earlyLeaveMinutes != null) {
    return { text: `${r.earlyLeaveMinutes} min early`, tone: 'warning' }
  }
  if (r.status === 'OVERTIME' && r.overtimeMinutes != null) {
    return { text: `${r.overtimeMinutes} min overtime`, tone: 'info' }
  }
  return null
}

function TimeCell({ iso, caption, tone }: { iso: string; caption: string | null; tone: CaptionTone | null }) {
  return (
    <Stack>
      <span>{formatTime(iso)}</span>
      {caption && tone && (
        <Typography variant="caption" fontWeight={700} sx={{ color: (t) => t.palette[tone].main }}>
          {caption}
        </Typography>
      )}
    </Stack>
  )
}

function ClockOutCell({ iso, record }: { iso: string; record: AttendanceRecord }) {
  const caption = clockOutCaption(record)
  return <TimeCell iso={iso} caption={caption?.text ?? null} tone={caption?.tone ?? null} />
}

function clockResultSummary(r: AttendanceRecord, kind: 'in' | 'out'): string {
  if (kind === 'in') {
    if (r.status === 'LATE' && r.lateMinutes != null) return `Clocked in — ${r.lateMinutes} min late`
    return 'Clocked in — on time'
  }
  if (r.status === 'EARLY_LEAVE' && r.earlyLeaveMinutes != null) {
    return `Clocked out — left ${r.earlyLeaveMinutes} min early`
  }
  if (r.status === 'OVERTIME' && r.overtimeMinutes != null) {
    return `Clocked out — ${r.overtimeMinutes} min overtime`
  }
  return 'Clocked out — on time'
}

function clockSeverity(r: AttendanceRecord, kind: 'in' | 'out'): 'success' | 'info' | 'warning' {
  if (kind === 'in' && r.status === 'LATE') return 'warning'
  if (kind === 'out' && r.status === 'EARLY_LEAVE') return 'warning'
  if (kind === 'out' && r.status === 'OVERTIME') return 'info'
  return 'success'
}
