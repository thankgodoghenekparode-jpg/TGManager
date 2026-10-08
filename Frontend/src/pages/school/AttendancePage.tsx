import { useState } from 'react';
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
import { schoolApi } from '../../api/school';

export function AttendancePage() {
  const qc = useQueryClient();
  const [selectedDate, setSelectedDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [selectedClassId, setSelectedClassId] = useState<string>('ALL');
  const [scannerOpen, setScannerOpen] = useState(false);
  const [scanInput, setScanInput] = useState('');
  const [lastScanResult, setLastScanResult] = useState<string | null>(null);

  const { data: stats } = useQuery({
    queryKey: ['school', 'attendance', 'stats', selectedDate],
    queryFn: () => schoolApi.getAttendanceStats(selectedDate),
  });

  const { data: attendanceRecords, isLoading } = useQuery({
    queryKey: ['school', 'attendance', selectedDate, selectedClassId],
    queryFn: () =>
      schoolApi.getAttendance({
        date: selectedDate,
        classId: selectedClassId !== 'ALL' ? selectedClassId : undefined,
      }),
  });

  const { data: classes } = useQuery({
    queryKey: ['school', 'classes'],
    queryFn: () => schoolApi.listClasses(),
  });

  const scanMutation = useMutation({
    mutationFn: (payload: string) => schoolApi.scanAttendance({ scanPayload: payload }),
    onSuccess: (data: any) => {
      qc.invalidateQueries({ queryKey: ['school', 'attendance'] });
      setLastScanResult(`Check-in recorded: ${data.student?.firstName ?? 'Student'} (${data.status})`);
      setScanInput('');
    },
    onError: (err: any) => {
      setLastScanResult(`Scan error: ${err.message || 'Unknown ID card'}`);
    },
  });

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
        <Button
          variant="contained"
          startIcon={<QrCodeScannerIcon />}
          onClick={() => {
            setScannerOpen(true);
            setLastScanResult(null);
          }}
          sx={{ textTransform: 'none', fontWeight: 600 }}
        >
          Open Gate Scanner
        </Button>
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
                {stats?.attendanceRate ?? 88}%
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
                onChange={(e) => setSelectedDate(e.target.value)}
              />
            </Grid>
            <Grid item xs={12} sm={6} md={4}>
              <TextField
                select
                fullWidth
                size="small"
                label="Filter by Classroom"
                value={selectedClassId}
                onChange={(e) => setSelectedClassId(e.target.value)}
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
                <TableCell>Verification Method</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Remarks / Notes</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {(attendanceRecords || []).map((rec) => (
                <TableRow key={rec.id} hover>
                  <TableCell>
                    <Typography variant="body2" fontWeight={700}>
                      {rec.student.firstName} {rec.student.lastName}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {rec.student.admissionNumber}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Chip label={rec.student.currentClass?.name ?? 'Assigned'} size="small" variant="outlined" />
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
                    <Chip label={rec.method.replace('_', ' ')} size="small" />
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
              {(!attendanceRecords || attendanceRecords.length === 0) && !isLoading && (
                <TableRow>
                  <TableCell colSpan={7} align="center" sx={{ py: 6, color: 'text.secondary' }}>
                    No attendance records for the selected date and class.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Card>

      {/* Gate Scanner Dialog */}
      <Dialog open={scannerOpen} onClose={() => setScannerOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 700 }}>Gate Security QR / Barcode Scanner</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2} sx={{ mt: 1, alignItems: 'center' }}>
            <Box
              sx={{
                width: 140,
                height: 140,
                bgcolor: 'rgba(14, 165, 233, 0.08)',
                border: '2px dashed #0284c7',
                borderRadius: 3,
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
                alignItems: 'center',
                gap: 1,
              }}
            >
              <QrCodeScannerIcon sx={{ fontSize: 56, color: 'primary.main' }} />
              <Typography variant="caption" color="text.secondary">
                Point reader at card
              </Typography>
            </Box>

            <Typography variant="body2" color="text.secondary" align="center">
              Scan student digital ID card barcode or QR code, or paste card QR identifier below:
            </Typography>

            <TextField
              fullWidth
              size="small"
              placeholder="e.g. STU-QR-tgeasy-model-college-0001"
              value={scanInput}
              onChange={(e) => setScanInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && scanInput.trim()) {
                  scanMutation.mutate(scanInput.trim());
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
            onClick={() => scanMutation.mutate(scanInput.trim())}
          >
            {scanMutation.isPending ? 'Verifying...' : 'Record Gate Entry'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
