import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Grid,
  MenuItem,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TablePagination,
  TableRow,
  TextField,
  Typography,
} from '@mui/material';
import LoginIcon from '@mui/icons-material/Login';
import LogoutIcon from '@mui/icons-material/Logout';
import LocationOnIcon from '@mui/icons-material/LocationOn';
import AddIcon from '@mui/icons-material/Add';
import {
  schoolApi,
  STAFF_ATTENDANCE_STATUSES,
  type StaffAttendanceRecord,
  type StaffAttendanceStatus,
} from '../../api/school';
import { apiErrorMessage } from '../../api/client';
import { useCan } from '../../components/PermissionGate';
import { getCurrentPosition } from '../../lib/geo';
import { ConfirmDialog } from '../../components/ConfirmDialog';

const todayKey = () => new Date().toISOString().slice(0, 10);

const statusColor = (
  status: StaffAttendanceStatus,
): 'success' | 'warning' | 'error' | 'default' => {
  if (status === 'ON_TIME' || status === 'OVERTIME') return 'success';
  if (status === 'LATE' || status === 'NO_CLOCK_OUT' || status === 'EARLY_LEAVE') return 'warning';
  if (status === 'ABSENT') return 'error';
  return 'default';
};

const fmtTime = (value?: string | null) =>
  value ? new Date(value).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—';

export function SchoolStaffAttendancePage() {
  const qc = useQueryClient();
  const canClockIn = useCan('attendance.clock_in');
  const canClockOut = useCan('attendance.clock_out');
  const canManage = useCan('school_staff_attendance.manage');

  const [from, setFrom] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 6);
    return d.toISOString().slice(0, 10);
  });
  const [to, setTo] = useState(todayKey());
  const [status, setStatus] = useState<string>('ALL');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(25);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<StaffAttendanceRecord | null>(null);

  const [recordOpen, setRecordOpen] = useState(false);
  const [recordForm, setRecordForm] = useState({
    schoolStaffId: '',
    date: todayKey(),
    clockInTime: '07:30',
    clockOutTime: '',
    status: 'ON_TIME' as StaffAttendanceStatus,
    note: '',
  });

  const { data: today } = useQuery({
    queryKey: ['school', 'staff-attendance', 'today'],
    queryFn: () => schoolApi.getMyStaffAttendanceToday(),
  });

  const { data: staffList } = useQuery({
    queryKey: ['school', 'staff', 'for-attendance'],
    queryFn: () => schoolApi.listSchoolStaff({ status: 'ACTIVE' }),
    enabled: canManage,
  });

  const { data: attendance, isLoading } = useQuery({
    queryKey: ['school', 'staff-attendance', from, to, status, search, page, rowsPerPage],
    queryFn: () =>
      schoolApi.listStaffAttendance({
        from,
        to,
        status: status !== 'ALL' ? (status as StaffAttendanceStatus) : undefined,
        search: search || undefined,
        page: page + 1,
        limit: rowsPerPage,
      }),
  });

  const records = attendance?.items ?? [];
  const myRecord = today?.record ?? null;

  const geotaggedClock = async (kind: 'in' | 'out') => {
    setError(null);
    setInfo(null);
    const { position, status: geoStatus } = await getCurrentPosition(6000);
    if (!position) {
      setError(
        geoStatus === 'denied'
          ? 'Location permission is required to clock in/out. Please allow location access.'
          : 'Could not read your location. Move to an area with GPS signal and retry.',
      );
      return;
    }
    if (kind === 'in') {
      await clockInMutation.mutateAsync({
        latitude: position.latitude,
        longitude: position.longitude,
      });
    } else {
      await clockOutMutation.mutateAsync({
        latitude: position.latitude,
        longitude: position.longitude,
      });
    }
  };

  const clockInMutation = useMutation({
    mutationFn: (payload: { latitude?: number | null; longitude?: number | null }) =>
      schoolApi.clockStaffIn(payload),
    onSuccess: (rec) => {
      qc.invalidateQueries({ queryKey: ['school', 'staff-attendance'] });
      setInfo(`Clocked in at ${fmtTime(rec.clockInAt)} • ${rec.status}`);
    },
    onError: (err) => setError(apiErrorMessage(err)),
  });

  const clockOutMutation = useMutation({
    mutationFn: (payload: { latitude?: number | null; longitude?: number | null }) =>
      schoolApi.clockStaffOut(payload),
    onSuccess: (rec) => {
      qc.invalidateQueries({ queryKey: ['school', 'staff-attendance'] });
      setInfo(`Clocked out at ${fmtTime(rec.clockOutAt)}`);
    },
    onError: (err) => setError(apiErrorMessage(err)),
  });

  const recordMutation = useMutation({
    mutationFn: () => {
      const base = recordForm.date;
      return schoolApi.recordStaffAttendance({
        schoolStaffId: recordForm.schoolStaffId,
        date: base,
        clockInAt: recordForm.clockInTime ? new Date(`${base}T${recordForm.clockInTime}:00`).toISOString() : null,
        clockOutAt: recordForm.clockOutTime ? new Date(`${base}T${recordForm.clockOutTime}:00`).toISOString() : null,
        status: recordForm.status,
        note: recordForm.note || null,
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['school', 'staff-attendance'] });
      setRecordOpen(false);
      setInfo('Attendance record saved.');
    },
    onError: (err) => setError(apiErrorMessage(err)),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => schoolApi.deleteStaffAttendance(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['school', 'staff-attendance'] });
      setConfirmDelete(null);
      setInfo('Attendance record deleted.');
    },
    onError: (err) => {
      setConfirmDelete(null);
      setError(apiErrorMessage(err));
    },
  });

  const openRecord = () => {
    setRecordForm({
      schoolStaffId: '',
      date: todayKey(),
      clockInTime: '07:30',
      clockOutTime: '',
      status: 'ON_TIME',
      note: '',
    });
    setError(null);
    setRecordOpen(true);
  };

  return (
    <Box sx={{ p: { xs: 2, md: 3 }, display: 'flex', flexDirection: 'column', gap: 3 }}>
      <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ xs: 'flex-start', sm: 'center' }} spacing={2}>
        <Box>
          <Typography variant="h5" fontWeight={700}>
            Staff Clock In / Out
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Staff attendance with location capture. Permissions are enforced by role.
          </Typography>
        </Box>
        <Stack direction="row" spacing={1.5} flexWrap="wrap">
          {canClockIn && (
            <Button
              variant="contained"
              color="success"
              startIcon={<LoginIcon />}
              disabled={clockInMutation.isPending || !!myRecord?.clockInAt}
              onClick={() => geotaggedClock('in')}
              sx={{ textTransform: 'none', fontWeight: 600 }}
            >
              {myRecord?.clockInAt ? `Clocked In ${fmtTime(myRecord.clockInAt)}` : clockInMutation.isPending ? 'Clocking in…' : 'Clock In'}
            </Button>
          )}
          {canClockOut && (
            <Button
              variant="contained"
              color="warning"
              startIcon={<LogoutIcon />}
              disabled={clockOutMutation.isPending || !myRecord?.clockInAt || !!myRecord?.clockOutAt}
              onClick={() => geotaggedClock('out')}
              sx={{ textTransform: 'none', fontWeight: 600 }}
            >
              {myRecord?.clockOutAt ? `Clocked Out ${fmtTime(myRecord.clockOutAt)}` : clockOutMutation.isPending ? 'Clocking out…' : 'Clock Out'}
            </Button>
          )}
          {canManage && (
            <Button variant="outlined" startIcon={<AddIcon />} onClick={openRecord} sx={{ textTransform: 'none' }}>
              Record / Correct
            </Button>
          )}
        </Stack>
      </Stack>

      {error && <Alert severity="error" onClose={() => setError(null)}>{error}</Alert>}
      {info && <Alert severity="success" onClose={() => setInfo(null)}>{info}</Alert>}
      {today && !today.staff && (
        <Alert severity="info">
          Your login is not linked to a staff profile yet. Ask a school administrator to link it so you can clock in/out.
        </Alert>
      )}

      {/* Today status */}
      {today?.staff && (
        <Card variant="outlined">
          <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems={{ sm: 'center' }} justifyContent="space-between">
              <Box>
                <Typography variant="subtitle2" fontWeight={700}>
                  {today.staff.firstName} {today.staff.lastName} • {today.staff.employeeNumber}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {today.staff.designation || today.staff.category}
                </Typography>
              </Box>
              <Stack direction="row" spacing={1} alignItems="center">
                <Chip label={`In: ${fmtTime(myRecord?.clockInAt)}`} size="small" color={myRecord?.clockInAt ? 'success' : 'default'} variant={myRecord?.clockInAt ? 'filled' : 'outlined'} />
                <Chip label={`Out: ${fmtTime(myRecord?.clockOutAt)}`} size="small" color={myRecord?.clockOutAt ? 'warning' : 'default'} variant={myRecord?.clockOutAt ? 'filled' : 'outlined'} />
                {myRecord?.status && <Chip label={myRecord.status} size="small" color={statusColor(myRecord.status)} />}
              </Stack>
            </Stack>
          </CardContent>
        </Card>
      )}

      {/* Filters */}
      <Card>
        <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
          <Grid container spacing={2} alignItems="center">
            <Grid item xs={12} sm={6} md={3}>
              <TextField
                fullWidth
                size="small"
                type="date"
                label="From"
                InputLabelProps={{ shrink: true }}
                value={from}
                onChange={(e) => { setFrom(e.target.value); setPage(0); }}
              />
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <TextField
                fullWidth
                size="small"
                type="date"
                label="To"
                InputLabelProps={{ shrink: true }}
                value={to}
                onChange={(e) => { setTo(e.target.value); setPage(0); }}
              />
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <TextField
                select
                fullWidth
                size="small"
                label="Status"
                value={status}
                onChange={(e) => { setStatus(e.target.value); setPage(0); }}
              >
                <MenuItem value="ALL">All statuses</MenuItem>
                {STAFF_ATTENDANCE_STATUSES.map((s) => (
                  <MenuItem key={s} value={s}>{s.replace('_', ' ')}</MenuItem>
                ))}
              </TextField>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <TextField
                fullWidth
                size="small"
                label="Search staff"
                placeholder="Name or employee no."
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(0); }}
              />
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Staff</TableCell>
                <TableCell>Date</TableCell>
                <TableCell>Clock In</TableCell>
                <TableCell>Clock Out</TableCell>
                <TableCell>Location</TableCell>
                <TableCell>Status</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {records.map((rec: StaffAttendanceRecord) => (
                <TableRow key={rec.id} hover>
                  <TableCell>
                    <Typography variant="body2" fontWeight={700}>
                      {rec.schoolStaff.firstName} {rec.schoolStaff.lastName}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {rec.schoolStaff.employeeNumber} • {rec.schoolStaff.designation || rec.schoolStaff.category}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2">{new Date(rec.date).toLocaleDateString()}</Typography>
                  </TableCell>
                  <TableCell>
                    <Stack direction="row" alignItems="center" spacing={0.5}>
                      <Typography variant="body2">{fmtTime(rec.clockInAt)}</Typography>
                      {rec.lateMinutes ? (
                        <Chip label={`+${rec.lateMinutes}m`} size="small" color="warning" />
                      ) : null}
                    </Stack>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2">{fmtTime(rec.clockOutAt)}</Typography>
                  </TableCell>
                  <TableCell>
                    <Stack direction="row" alignItems="center" spacing={0.5}>
                      {rec.clockInLat != null && rec.clockInLng != null && (
                        <LocationOnIcon sx={{ fontSize: 16, color: 'success.main' }} />
                      )}
                      <Typography variant="caption" color="text.secondary">
                        {rec.clockInLat != null && rec.clockInLng != null
                          ? `${rec.clockInLat.toFixed(4)}, ${rec.clockInLng.toFixed(4)}`
                          : '—'}
                      </Typography>
                    </Stack>
                  </TableCell>
                  <TableCell>
                    <Chip label={rec.status.replace('_', ' ')} size="small" color={statusColor(rec.status)} />
                  </TableCell>
                  <TableCell align="right">
                    {canManage && (
                      <Button
                        size="small"
                        color="error"
                        onClick={() => setConfirmDelete(rec)}
                        sx={{ textTransform: 'none' }}
                      >
                        Delete
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
              {records.length === 0 && !isLoading && (
                <TableRow>
                  <TableCell colSpan={7} align="center" sx={{ py: 6, color: 'text.secondary' }}>
                    No staff attendance records for the selected filters.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
        <TablePagination
          component="div"
          count={attendance?.total ?? 0}
          page={page}
          onPageChange={(_, p) => setPage(p)}
          rowsPerPage={rowsPerPage}
          onRowsPerPageChange={(e) => {
            setRowsPerPage(parseInt(e.target.value, 10));
            setPage(0);
          }}
          rowsPerPageOptions={[10, 25, 50, 100]}
        />
      </Card>

      {/* Manual record dialog */}
      <Dialog open={recordOpen} onClose={() => setRecordOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 700 }}>Record / Correct Staff Attendance</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField
              select
              fullWidth
              size="small"
              label="Staff Member"
              value={recordForm.schoolStaffId}
              onChange={(e) => setRecordForm({ ...recordForm, schoolStaffId: e.target.value })}
            >
              {(staffList || []).map((s) => (
                <MenuItem key={s.id} value={s.id}>
                  {s.firstName} {s.lastName} ({s.employeeNumber})
                </MenuItem>
              ))}
            </TextField>
            <TextField
              fullWidth
              size="small"
              type="date"
              label="Date"
              InputLabelProps={{ shrink: true }}
              value={recordForm.date}
              onChange={(e) => setRecordForm({ ...recordForm, date: e.target.value })}
            />
            <Stack direction="row" spacing={1.5}>
              <TextField
                fullWidth
                size="small"
                type="time"
                label="Clock In"
                InputLabelProps={{ shrink: true }}
                value={recordForm.clockInTime}
                onChange={(e) => setRecordForm({ ...recordForm, clockInTime: e.target.value })}
              />
              <TextField
                fullWidth
                size="small"
                type="time"
                label="Clock Out"
                InputLabelProps={{ shrink: true }}
                value={recordForm.clockOutTime}
                onChange={(e) => setRecordForm({ ...recordForm, clockOutTime: e.target.value })}
              />
            </Stack>
            <TextField
              select
              fullWidth
              size="small"
              label="Status"
              value={recordForm.status}
              onChange={(e) => setRecordForm({ ...recordForm, status: e.target.value as StaffAttendanceStatus })}
            >
              {STAFF_ATTENDANCE_STATUSES.map((s) => (
                <MenuItem key={s} value={s}>{s.replace('_', ' ')}</MenuItem>
              ))}
            </TextField>
            <TextField
              fullWidth
              size="small"
              label="Note"
              value={recordForm.note}
              onChange={(e) => setRecordForm({ ...recordForm, note: e.target.value })}
            />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setRecordOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            disabled={!recordForm.schoolStaffId || recordMutation.isPending}
            onClick={() => recordMutation.mutate()}
          >
            {recordMutation.isPending ? 'Saving…' : 'Save Record'}
          </Button>
        </DialogActions>
      </Dialog>

      <ConfirmDialog
        open={confirmDelete !== null}
        title="Delete attendance record"
        message="Delete this staff attendance record? This cannot be undone."
        confirmLabel="Delete"
        destructive
        pending={deleteMutation.isPending}
        onConfirm={() => confirmDelete && deleteMutation.mutate(confirmDelete.id)}
        onClose={() => setConfirmDelete(null)}
      />
    </Box>
  );
}
