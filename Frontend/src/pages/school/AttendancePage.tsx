import { useRef, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
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
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from '@mui/material';
import QrCodeScannerIcon from '@mui/icons-material/QrCodeScanner';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import LocationOnIcon from '@mui/icons-material/LocationOn';
import HowToRegIcon from '@mui/icons-material/HowToReg';
import { schoolApi } from '../../api/school';
import { QrScanner } from '../../components/QrScanner';
import { getCurrentPosition, type GeoPosition } from '../../lib/geo';
import { Can } from '../../components/PermissionGate';
import { useToast } from '../../components/ToastProvider';

export function AttendancePage() {
  const qc = useQueryClient();
  const toast = useToast();
  const [selectedDate, setSelectedDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [selectedClassId, setSelectedClassId] = useState<string>('ALL');
  const [scannerOpen, setScannerOpen] = useState(false);
  const [scanInput, setScanInput] = useState('');
  const [lastScanResult, setLastScanResult] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(25);
  const [markOpen, setMarkOpen] = useState(false);
  const [markClassId, setMarkClassId] = useState('');
  const [markDate, setMarkDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [markStatuses, setMarkStatuses] = useState<Record<string, string>>({});

  // Last known device location, reused briefly so gate scans are geotagged
  // without waiting on the browser every single time.
  const positionRef = useRef<{ position: GeoPosition; at: number } | null>(null);

  const prefetchPosition = () => {
    // Kick off the (re)load early so a permission prompt is shown before the
    // first scan and, once granted, scans are tagged instantly.
    void getCurrentPosition(8000).then(({ position }) => {
      if (position) positionRef.current = { position, at: Date.now() };
    });
  };

  /**
   * Best-effort location for a scan. Never blocks the scan for long: it reuses a
   * recent fix when available, otherwise waits only briefly (and always returns
   * within ~3s even if the browser/webview never answers the permission prompt).
   */
  const resolveScanPosition = async (): Promise<GeoPosition | null> => {
    const cached = positionRef.current;
    if (cached && Date.now() - cached.at < 120_000) return cached.position;
    const { position } = await getCurrentPosition(2500);
    if (position) {
      positionRef.current = { position, at: Date.now() };
      return position;
    }
    return null;
  };

  const { data: stats } = useQuery({
    queryKey: ['school', 'attendance', 'stats', selectedDate],
    queryFn: () => schoolApi.getAttendanceStats(selectedDate),
  });

  const { data: attendanceData, isLoading } = useQuery({
    queryKey: ['school', 'attendance', selectedDate, selectedClassId, page, rowsPerPage],
    queryFn: () =>
      schoolApi.getAttendancePaged({
        date: selectedDate,
        classId: selectedClassId !== 'ALL' ? selectedClassId : undefined,
        page: page + 1,
        limit: rowsPerPage,
      }),
  });

  const { data: classes } = useQuery({
    queryKey: ['school', 'classes'],
    queryFn: () => schoolApi.listClasses(),
  });

  const recordsList = attendanceData?.items ?? [];

  const { data: markStudents, isLoading: markStudentsLoading } = useQuery({
    queryKey: ['school', 'students', 'mark', markClassId],
    queryFn: () => schoolApi.listStudents({ classId: markClassId, limit: 200 }),
    enabled: markOpen && !!markClassId,
  });

  const markMutation = useMutation({
    mutationFn: async () => {
      const records = (markStudents?.items ?? []).map((s) => ({
        studentId: s.id,
        status: markStatuses[s.id] ?? 'PRESENT',
      }));
      // Tag the classroom register with the marker's location.
      const { position } = await getCurrentPosition(6000);
      return schoolApi.markAttendanceBulk({
        date: markDate,
        classId: markClassId,
        records,
        latitude: position?.latitude ?? null,
        longitude: position?.longitude ?? null,
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['school', 'attendance'] });
      setMarkOpen(false);
      setMarkStatuses({});
      toast.success('Attendance saved.');
    },
  });

  const scanMutation = useMutation({
    mutationFn: async (payload: string) => {
      // Capture the scanning device's position so the gate/classroom check-in is
      // geotagged (and validated against the admin-set campus geofence). This is
      // best-effort: a missing/denied location never blocks the scan itself.
      const position = await resolveScanPosition();
      return schoolApi.scanAttendance({
        scanPayload: payload,
        latitude: position?.latitude ?? null,
        longitude: position?.longitude ?? null,
      });
    },
    onSuccess: (data: any) => {
      qc.invalidateQueries({ queryKey: ['school', 'attendance'] });
      const action =
        data?.action === 'CHECK_OUT'
          ? 'Check-out recorded'
          : 'Check-in recorded';
      setLastScanResult(
        `${action}: ${data.student?.firstName ?? 'Student'} ${data.student?.lastName ?? ''} (${data.status})`,
      );
      setScanInput('');
    },
    onError: (err: any) => {
      const message =
        err?.response?.data?.message ??
        err?.message ??
        'Unknown ID card';
      setLastScanResult(`Scan error: ${message}`);
    },
  });

  const handleScan = (text: string) => {
    const code = text.trim();
    if (!code || scanMutation.isPending) return;
    setScanInput(code);
    scanMutation.mutate(code);
  };

  return (
    <Box sx={{ p: { xs: 2, md: 3 }, display: 'flex', flexDirection: 'column', gap: 3 }}>
      {/* Header */}
      <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ xs: 'flex-start', sm: 'center' }} spacing={2}>
        <Box>
          <Typography variant="h5" fontWeight={700}>
            Gate & Classroom Attendance
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Digital ID card scanning, RFID gate log, and daily attendance records
          </Typography>
        </Box>
        <Stack direction="row" spacing={1.5} flexWrap="wrap">
          <Can permissions={['school_attendance.manage']}>
            <Button
              variant="outlined"
              startIcon={<HowToRegIcon />}
              onClick={() => {
                setMarkStatuses({});
                setMarkOpen(true);
              }}
              sx={{ textTransform: 'none', fontWeight: 600 }}
            >
              Mark Classroom Attendance
            </Button>
          </Can>
          <Button
            variant="contained"
            startIcon={<QrCodeScannerIcon />}
            onClick={() => {
              setScannerOpen(true);
              setLastScanResult(null);
              prefetchPosition();
            }}
            sx={{ textTransform: 'none', fontWeight: 600 }}
          >
            Open Gate Scanner
          </Button>
        </Stack>
      </Stack>

      {/* KPI Stats */}
      <Grid container spacing={2}>
        <Grid item xs={6} md={3}>
          <Card>
            <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
              <Typography variant="caption" color="text.secondary" fontWeight={600}>
                ATTENDANCE RATE
              </Typography>
              <Typography variant="h4" fontWeight={700} color="primary.main">
                {stats?.attendanceRatePercent ?? 88}%
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Daily completion
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={6} md={3}>
          <Card>
            <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
              <Typography variant="caption" color="text.secondary" fontWeight={600}>
                ON-TIME ARRIVALS
              </Typography>
              <Typography variant="h4" fontWeight={700} color="success.main">
                {stats?.present ?? 26}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Before 7:50 AM cutoff
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={6} md={3}>
          <Card>
            <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
              <Typography variant="caption" color="text.secondary" fontWeight={600}>
                LATE ARRIVALS
              </Typography>
              <Typography variant="h4" fontWeight={700} color="warning.main">
                {stats?.late ?? 4}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                After 7:50 AM
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={6} md={3}>
          <Card>
            <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
              <Typography variant="caption" color="text.secondary" fontWeight={600}>
                ABSENT STUDENTS
              </Typography>
              <Typography variant="h4" fontWeight={700} color="error.main">
                {stats?.absent ?? 0}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Unexcused
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Filter Row */}
      <Card>
        <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
          <Grid container spacing={2} alignItems="center">
            <Grid item xs={12} sm={6} md={4}>
              <TextField
                fullWidth
                size="small"
                type="date"
                label="Attendance Date"
                InputLabelProps={{ shrink: true }}
                value={selectedDate}
                onChange={(e) => {
                  setSelectedDate(e.target.value);
                  setPage(0);
                }}
              />
            </Grid>
            <Grid item xs={12} sm={6} md={4}>
              <TextField
                select
                fullWidth
                size="small"
                label="Filter by Classroom"
                value={selectedClassId}
                onChange={(e) => {
                  setSelectedClassId(e.target.value);
                  setPage(0);
                }}
              >
                <MenuItem value="ALL">All Classrooms</MenuItem>
                {(classes || []).map((cls) => (
                  <MenuItem key={cls.id} value={cls.id}>
                    {cls.name} ({cls.level})
                  </MenuItem>
                ))}
              </TextField>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* Attendance Log Table */}
      <Card>
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Student</TableCell>
                <TableCell>Class</TableCell>
                <TableCell>Morning Check-in</TableCell>
                <TableCell>Afternoon Check-out</TableCell>
                <TableCell>Gate / Location</TableCell>
                <TableCell>Verification Method</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Remarks / Notes</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {recordsList.map((rec: any) => (
                <TableRow key={rec.id} hover>
                  <TableCell>
                    <Typography variant="body2" fontWeight={700}>
                      {rec.student?.firstName ?? 'Student'} {rec.student?.lastName ?? ''}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {rec.student?.admissionNumber ?? '—'}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Chip label={rec.student?.currentClass?.name ?? 'Assigned'} size="small" variant="outlined" />
                  </TableCell>
                  <TableCell>
                    <Stack direction="row" alignItems="center" spacing={0.5}>
                      <AccessTimeIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
                      <Typography variant="body2">
                        {rec.checkInTime ? new Date(rec.checkInTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'}
                      </Typography>
                    </Stack>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2">
                      {rec.checkOutTime ? new Date(rec.checkOutTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'On Campus'}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Stack direction="row" alignItems="center" spacing={0.5}>
                      {rec.latitude != null && rec.longitude != null && (
                        <LocationOnIcon sx={{ fontSize: 16, color: 'success.main' }} />
                      )}
                      <Typography variant="caption" color="text.secondary">
                        {rec.gate?.name
                          ? rec.gate.name
                          : rec.latitude != null && rec.longitude != null
                          ? `${rec.latitude.toFixed(4)}, ${rec.longitude.toFixed(4)}`
                          : '—'}
                      </Typography>
                    </Stack>
                  </TableCell>
                  <TableCell>
                    <Chip label={(rec.method ?? 'QR_SCAN').replace('_', ' ')} size="small" />
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={rec.status}
                      size="small"
                      color={rec.status === 'PRESENT' ? 'success' : rec.status === 'LATE' ? 'warning' : 'error'}
                    />
                  </TableCell>
                  <TableCell>
                    <Typography variant="caption" color="text.secondary">
                      {rec.notes ?? '—'}
                    </Typography>
                  </TableCell>
                </TableRow>
              ))}
              {recordsList.length === 0 && !isLoading && (
                <TableRow>
                  <TableCell colSpan={8} align="center" sx={{ py: 6, color: 'text.secondary' }}>
                    No attendance records for the selected date and class.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
        <TablePagination
          component="div"
          count={attendanceData?.total ?? 0}
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

      {/* Gate Scanner Dialog */}
      <Dialog open={scannerOpen} onClose={() => setScannerOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 700 }}>Gate Security QR / Barcode Scanner</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2} sx={{ mt: 1, alignItems: 'center' }}>
            <QrScanner
              onScan={handleScan}
              paused={scanMutation.isPending}
            />

            <Typography variant="body2" color="text.secondary" align="center">
              Point the camera at the student ID card. The QR code or barcode is
              detected automatically; you can also type or paste the card code below:
            </Typography>

            <TextField
              fullWidth
              size="small"
              placeholder="e.g. STU-QR-tgeasy-model-college-0001"
              value={scanInput}
              onChange={(e) => setScanInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && scanInput.trim()) {
                  handleScan(scanInput);
                }
              }}
            />

            {lastScanResult && (
              <Alert severity={lastScanResult.startsWith('Scan error') ? 'error' : 'success'} sx={{ width: '100%' }}>
                {lastScanResult}
              </Alert>
            )}
          </Stack>
        </DialogContent>
        <DialogActions sx={{ p: 2, justifyContent: 'space-between' }}>
          <Button onClick={() => setScannerOpen(false)}>Close</Button>
          <Button
            variant="contained"
            disabled={!scanInput.trim() || scanMutation.isPending}
            onClick={() => handleScan(scanInput)}
          >
            {scanMutation.isPending ? 'Verifying...' : 'Record Gate Entry'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Mark Classroom Attendance Dialog */}
      <Dialog open={markOpen} onClose={() => setMarkOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 700 }}>Mark Classroom Attendance</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
              <TextField
                select
                fullWidth
                size="small"
                label="Classroom"
                value={markClassId}
                onChange={(e) => {
                  setMarkClassId(e.target.value);
                  setMarkStatuses({});
                }}
              >
                {(classes || []).map((cls) => (
                  <MenuItem key={cls.id} value={cls.id}>
                    {cls.name} ({cls.level})
                  </MenuItem>
                ))}
              </TextField>
              <TextField
                fullWidth
                size="small"
                type="date"
                label="Date"
                InputLabelProps={{ shrink: true }}
                value={markDate}
                onChange={(e) => setMarkDate(e.target.value)}
              />
            </Stack>

            <Alert severity="info" icon={<LocationOnIcon />}>
              Your current location is captured with this register.
            </Alert>

            {markClassId && (
              <TableContainer sx={{ maxHeight: 340 }}>
                <Table size="small" stickyHeader>
                  <TableHead>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 700 }}>Student</TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>Admission No.</TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>Status</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {markStudentsLoading && (
                      <TableRow>
                        <TableCell colSpan={3} align="center" sx={{ py: 3 }}>
                          Loading students…
                        </TableCell>
                      </TableRow>
                    )}
                    {(markStudents?.items ?? []).map((s) => (
                      <TableRow key={s.id}>
                        <TableCell>
                          {s.firstName} {s.lastName}
                        </TableCell>
                        <TableCell>{s.admissionNumber}</TableCell>
                        <TableCell>
                          <TextField
                            select
                            size="small"
                            value={markStatuses[s.id] ?? 'PRESENT'}
                            onChange={(e) =>
                              setMarkStatuses((prev) => ({ ...prev, [s.id]: e.target.value }))
                            }
                            sx={{ minWidth: 130 }}
                          >
                            <MenuItem value="PRESENT">Present</MenuItem>
                            <MenuItem value="LATE">Late</MenuItem>
                            <MenuItem value="ABSENT">Absent</MenuItem>
                            <MenuItem value="EXCUSED">Excused</MenuItem>
                          </TextField>
                        </TableCell>
                      </TableRow>
                    ))}
                    {!markStudentsLoading && (markStudents?.items ?? []).length === 0 && (
                      <TableRow>
                        <TableCell colSpan={3} align="center" sx={{ py: 3 }}>
                          <Typography variant="body2" color="text.secondary">
                            No students in this class.
                          </Typography>
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </TableContainer>
            )}
          </Stack>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setMarkOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            disabled={!markClassId || !(markStudents?.items ?? []).length || markMutation.isPending}
            onClick={() => markMutation.mutate()}
          >
            {markMutation.isPending ? 'Saving...' : 'Save Attendance'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
