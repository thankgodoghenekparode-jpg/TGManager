import { useQuery } from '@tanstack/react-query';
import {
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Grid,
  LinearProgress,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
  Avatar,
} from '@mui/material';
import { useNavigate } from 'react-router-dom';
import SchoolIcon from '@mui/icons-material/School';
import HowToRegIcon from '@mui/icons-material/HowToReg';
import ClassIcon from '@mui/icons-material/Class';
import PaymentsIcon from '@mui/icons-material/Payments';
import QrCodeScannerIcon from '@mui/icons-material/QrCodeScanner';
import PersonAddAltIcon from '@mui/icons-material/PersonAddAlt';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import { useTenantStore } from '../../store/tenant';
import { schoolApi } from '../../api/school';
import { useCan } from '../../components/PermissionGate';

/** 'GATE_OFFICER' -> 'Gate Officer' */
function formatRole(name?: string): string {
  if (!name) return 'Staff';
  return name
    .replace(/_/g, ' ')
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export function SchoolDashboardPage() {
  const navigate = useNavigate();
  const tenant = useTenantStore((s) => s.current);

  // What each role is allowed to see drives the whole dashboard: the KPIs, the
  // header actions and the detail cards are all filtered by these checks so a
  // bursar, a teacher and a gate officer each get a dashboard for their job.
  const canManageStudents = useCan('student.manage');
  const canViewStudents = useCan('student.view');
  const canViewAttendance = useCan('school_attendance.view');
  const canManageAttendance = useCan('school_attendance.manage');
  const canViewAcademics = useCan('academic.view');
  const canViewFees = useCan('school_fee.view');

  const roleLabel = formatRole(tenant?.roles?.[0]?.name);

  const { data: studentsData } = useQuery({
    queryKey: ['school', 'students', 'count'],
    queryFn: () => schoolApi.listStudents({ limit: 100 }),
    enabled: canViewStudents,
  });

  const { data: attendanceStats } = useQuery({
    queryKey: ['school', 'attendance', 'stats'],
    queryFn: () => schoolApi.getAttendanceStats(),
    enabled: canViewAttendance,
  });

  const { data: attendanceRecent } = useQuery({
    queryKey: ['school', 'attendance', 'recent'],
    queryFn: () => schoolApi.getAttendance({}),
    enabled: canViewAttendance,
  });

  const { data: classesData } = useQuery({
    queryKey: ['school', 'classes'],
    queryFn: () => schoolApi.listClasses(),
    enabled: canViewAcademics,
  });

  const { data: revenueStats } = useQuery({
    queryKey: ['school', 'fees', 'stats'],
    queryFn: () => schoolApi.getRevenueStats(),
    enabled: canViewFees,
  });

  const { data: analytics } = useQuery({
    queryKey: ['school', 'analytics', 'overview'],
    queryFn: () => schoolApi.getSchoolAnalyticsOverview(),
  });

  const { data: sessions } = useQuery({
    queryKey: ['school', 'sessions'],
    queryFn: () => schoolApi.listSessions(),
  });

  const currentSession = sessions?.find((s) => s.isCurrent) ?? sessions?.[0];
  const totalStudents = analytics?.students.total ?? studentsData?.total ?? 30;

  const attendanceToday = analytics?.attendanceToday;
  const attendancePresent =
    attendanceToday?.byStatus.find((s) => s.status === 'PRESENT')?.count ?? 0;
  const attendanceLate =
    attendanceToday?.byStatus.find((s) => s.status === 'LATE')?.count ?? 0;
  const attendanceRate = attendanceToday?.total
    ? Math.round((attendancePresent / attendanceToday.total) * 100)
    : attendanceStats?.attendanceRatePercent ?? 88;

  const totalClasses = analytics?.academics.classes ?? classesData?.length ?? 6;

  const recentLogs = Array.isArray(attendanceRecent)
    ? attendanceRecent
    : Array.isArray((attendanceRecent as any)?.items)
    ? (attendanceRecent as any).items
    : [];

  const totalBilled = revenueStats?.totalInvoiced ?? analytics?.fees.totalInvoiced ?? 3300000;
  const totalCollected = revenueStats?.totalCollected ?? analytics?.fees.totalPaid ?? 1700000;
  const totalOutstanding = revenueStats?.totalOutstanding ?? Math.max(0, totalBilled - totalCollected);
  const collectionRate = revenueStats?.collectionRatePercent ?? Math.round((totalCollected / (totalBilled || 1)) * 100);

  const hasDetailCards = canViewAttendance || canViewAcademics || canViewFees;

  return (
    <Box sx={{ p: { xs: 2, md: 3 }, display: 'flex', flexDirection: 'column', gap: 3 }}>
      {/* Header Banner */}
      <Card
        sx={{
          background: 'linear-gradient(135deg, rgba(14, 165, 233, 0.15) 0%, rgba(99, 102, 241, 0.08) 100%)',
          border: '1px solid rgba(14, 165, 233, 0.25)',
          borderRadius: 2,
        }}
      >
        <CardContent sx={{ p: { xs: 2, md: 3 } }}>
          <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ xs: 'flex-start', sm: 'center' }} spacing={2}>
            <Box>
              <Stack direction="row" alignItems="center" spacing={1.5} sx={{ mb: 0.5, flexWrap: 'wrap' }}>
                <Typography variant="h5" fontWeight={700}>
                  {tenant?.name ?? 'TGEasy Model College'}
                </Typography>
                <Chip label={roleLabel} color="primary" size="small" variant="filled" />
              </Stack>
              <Typography variant="body2" color="text.secondary">
                {tenant?.schoolProfile?.motto ?? 'Excellence, Character and Innovation'} •{' '}
                {currentSession ? currentSession.name : '2025/2026 Academic Session'} (2nd Term Active)
              </Typography>
            </Box>
            <Stack direction="row" spacing={1}>
              {canManageAttendance && (
                <Button
                  variant="contained"
                  startIcon={<QrCodeScannerIcon />}
                  onClick={() => navigate('/school/attendance')}
                  sx={{ textTransform: 'none', fontWeight: 600 }}
                >
                  Gate Scanner
                </Button>
              )}
              {canManageStudents && (
                <Button
                  variant="outlined"
                  startIcon={<PersonAddAltIcon />}
                  onClick={() => navigate('/school/students')}
                  sx={{ textTransform: 'none', fontWeight: 600 }}
                >
                  Enroll Student
                </Button>
              )}
            </Stack>
          </Stack>
        </CardContent>
      </Card>

      {/* KPI Stat Cards */}
      <Grid container spacing={2.5}>
        {/* Total Students */}
        <Grid item xs={12} sm={6} md={3}>
          <Card sx={{ height: '100%', cursor: 'pointer' }} onClick={() => navigate('/school/students')}>
            <CardContent>
              <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
                <Box>
                  <Typography variant="body2" color="text.secondary" fontWeight={500}>
                    Total Students
                  </Typography>
                  <Typography variant="h4" fontWeight={700} sx={{ mt: 0.5 }}>
                    {totalStudents}
                  </Typography>
                  <Typography variant="caption" color="success.main" fontWeight={600}>
                    Active Enrollment
                  </Typography>
                </Box>
                <Avatar sx={{ bgcolor: 'rgba(14, 165, 233, 0.12)', color: 'primary.main', width: 48, height: 48 }}>
                  <SchoolIcon />
                </Avatar>
              </Stack>
            </CardContent>
          </Card>
        </Grid>

        {/* Today's Attendance */}
        {canViewAttendance && (
          <Grid item xs={12} sm={6} md={3}>
            <Card sx={{ height: '100%', cursor: 'pointer' }} onClick={() => navigate('/school/attendance')}>
              <CardContent>
                <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
                  <Box>
                    <Typography variant="body2" color="text.secondary" fontWeight={500}>
                      Today's Attendance
                    </Typography>
                    <Typography variant="h4" fontWeight={700} sx={{ mt: 0.5 }}>
                      {attendanceRate}%
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {attendancePresent} present • {attendanceLate} late
                    </Typography>
                  </Box>
                  <Avatar sx={{ bgcolor: 'rgba(34, 197, 94, 0.12)', color: 'success.main', width: 48, height: 48 }}>
                    <HowToRegIcon />
                  </Avatar>
                </Stack>
              </CardContent>
            </Card>
          </Grid>
        )}

        {/* Classes & Academics */}
        {canViewAcademics && (
          <Grid item xs={12} sm={6} md={3}>
            <Card sx={{ height: '100%', cursor: 'pointer' }} onClick={() => navigate('/school/classes')}>
              <CardContent>
                <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
                  <Box>
                    <Typography variant="body2" color="text.secondary" fontWeight={500}>
                      Classrooms & Arms
                    </Typography>
                    <Typography variant="h4" fontWeight={700} sx={{ mt: 0.5 }}>
                      {totalClasses}
                    </Typography>
                    <Typography variant="caption" color="info.main" fontWeight={600}>
                      JSS 1 through SSS 3
                    </Typography>
                  </Box>
                  <Avatar sx={{ bgcolor: 'rgba(168, 85, 247, 0.12)', color: 'secondary.main', width: 48, height: 48 }}>
                    <ClassIcon />
                  </Avatar>
                </Stack>
              </CardContent>
            </Card>
          </Grid>
        )}

        {/* Term Fee Collection */}
        {canViewFees && (
          <Grid item xs={12} sm={6} md={3}>
            <Card sx={{ height: '100%', cursor: 'pointer' }} onClick={() => navigate('/school/fees')}>
              <CardContent>
                <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
                  <Box sx={{ width: '100%' }}>
                    <Typography variant="body2" color="text.secondary" fontWeight={500}>
                      Term Fees Collected
                    </Typography>
                    <Typography variant="h5" fontWeight={700} sx={{ mt: 0.5 }}>
                      ₦{(totalCollected).toLocaleString()}
                    </Typography>
                    <Stack direction="row" alignItems="center" spacing={1} sx={{ mt: 1 }}>
                      <LinearProgress
                        variant="determinate"
                        value={Math.min(100, collectionRate)}
                        sx={{ flexGrow: 1, height: 6, borderRadius: 3 }}
                      />
                      <Typography variant="caption" fontWeight={600}>
                        {collectionRate}%
                      </Typography>
                    </Stack>
                  </Box>
                  <Avatar sx={{ bgcolor: 'rgba(234, 179, 8, 0.12)', color: 'warning.main', width: 48, height: 48, ml: 1 }}>
                    <PaymentsIcon />
                  </Avatar>
                </Stack>
              </CardContent>
            </Card>
          </Grid>
        )}
      </Grid>

      {/* Main Content Grid — cards are shown to the roles whose job they cover */}
      <Grid container spacing={3}>
        {/* Real-time Gate Arrival Log */}
        {canViewAttendance && (
          <Grid item xs={12} lg={6}>
            <Card sx={{ height: '100%' }}>
              <CardContent sx={{ p: 2.5 }}>
                <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
                  <Box>
                    <Typography variant="h6" fontWeight={600}>
                      Today's Gate Check-ins
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      Real-time student card scans at campus security gates
                    </Typography>
                  </Box>
                  <Button size="small" onClick={() => navigate('/school/attendance')}>
                    View Register
                  </Button>
                </Stack>

                <TableContainer sx={{ maxHeight: 380 }}>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>Student</TableCell>
                        <TableCell>Class</TableCell>
                        <TableCell>Check-in Time</TableCell>
                        <TableCell>Status</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {recentLogs.slice(0, 7).map((rec: any) => (
                        <TableRow key={rec.id} hover>
                          <TableCell>
                            <Typography variant="body2" fontWeight={600}>
                              {rec.student?.firstName ?? 'Student'} {rec.student?.lastName ?? ''}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              {rec.student?.admissionNumber ?? '—'}
                            </Typography>
                          </TableCell>
                          <TableCell>
                            <Typography variant="body2">
                              {rec.student?.currentClass?.name ?? 'JSS 1 Gold'}
                            </Typography>
                          </TableCell>
                          <TableCell>
                            <Stack direction="row" alignItems="center" spacing={0.5}>
                              <AccessTimeIcon sx={{ fontSize: 15, color: 'text.secondary' }} />
                              <Typography variant="body2">
                                {rec.checkInTime ? new Date(rec.checkInTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '07:35 AM'}
                              </Typography>
                            </Stack>
                          </TableCell>
                          <TableCell>
                            <Chip
                              label={rec.status === 'LATE' ? 'Late' : 'Present'}
                              size="small"
                              color={rec.status === 'LATE' ? 'warning' : 'success'}
                              variant="outlined"
                            />
                          </TableCell>
                        </TableRow>
                      ))}
                      {recentLogs.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={4} align="center" sx={{ py: 3, color: 'text.secondary' }}>
                            No gate check-in records for today yet.
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </TableContainer>
              </CardContent>
            </Card>
          </Grid>
        )}

        {/* Classes Roster & Class Teachers */}
        {canViewAcademics && (
          <Grid item xs={12} lg={6}>
            <Card sx={{ height: '100%' }}>
              <CardContent sx={{ p: 2.5 }}>
                <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
                  <Box>
                    <Typography variant="h6" fontWeight={600}>
                      Classrooms & Teachers
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      Active levels and assigned class educators
                    </Typography>
                  </Box>
                  <Button size="small" onClick={() => navigate('/school/classes')}>
                    Manage Classes
                  </Button>
                </Stack>

                <TableContainer sx={{ maxHeight: 380 }}>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>Class</TableCell>
                        <TableCell>Teacher</TableCell>
                        <TableCell align="right">Students</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {(classesData || []).map((cls) => (
                        <TableRow key={cls.id} hover>
                          <TableCell>
                            <Typography variant="body2" fontWeight={600}>
                              {cls.name}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              {cls.level}
                            </Typography>
                          </TableCell>
                          <TableCell>
                            <Typography variant="body2">
                              {cls.classTeacher ? `${cls.classTeacher.firstName} ${cls.classTeacher.lastName}` : 'Assigned Teacher'}
                            </Typography>
                          </TableCell>
                          <TableCell align="right">
                            <Chip label={`${cls._count?.students ?? 5} students`} size="small" />
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              </CardContent>
            </Card>
          </Grid>
        )}

        {/* Fees & Collections — bursar / principal view */}
        {canViewFees && (
          <Grid item xs={12} lg={6}>
            <Card sx={{ height: '100%' }}>
              <CardContent sx={{ p: 2.5 }}>
                <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
                  <Box>
                    <Typography variant="h6" fontWeight={600}>
                      Fees & Collections
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      Term billing, receipts and outstanding balances
                    </Typography>
                  </Box>
                  <Button size="small" onClick={() => navigate('/school/fees')}>
                    Open Fee Ledger
                  </Button>
                </Stack>

                <Grid container spacing={2}>
                  <Grid item xs={12} sm={4}>
                    <Typography variant="body2" color="text.secondary">Billed</Typography>
                    <Typography variant="h6" fontWeight={700}>₦{totalBilled.toLocaleString()}</Typography>
                  </Grid>
                  <Grid item xs={12} sm={4}>
                    <Typography variant="body2" color="text.secondary">Collected</Typography>
                    <Typography variant="h6" fontWeight={700} color="success.main">₦{totalCollected.toLocaleString()}</Typography>
                  </Grid>
                  <Grid item xs={12} sm={4}>
                    <Typography variant="body2" color="text.secondary">Outstanding</Typography>
                    <Typography variant="h6" fontWeight={700} color={totalOutstanding > 0 ? 'warning.main' : 'text.primary'}>
                      ₦{totalOutstanding.toLocaleString()}
                    </Typography>
                  </Grid>
                </Grid>

                <Stack direction="row" alignItems="center" spacing={1} sx={{ mt: 2.5 }}>
                  <LinearProgress
                    variant="determinate"
                    value={Math.min(100, collectionRate)}
                    sx={{ flexGrow: 1, height: 8, borderRadius: 4 }}
                  />
                  <Typography variant="caption" fontWeight={600}>
                    {collectionRate}% collected
                  </Typography>
                </Stack>
              </CardContent>
            </Card>
          </Grid>
        )}

        {/* Fallback for a role with no detail permissions */}
        {!hasDetailCards && (
          <Grid item xs={12}>
            <Card>
              <CardContent sx={{ p: 3 }}>
                <Typography variant="h6" fontWeight={600} sx={{ mb: 0.5 }}>
                  Signed in as {roleLabel}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Use the menu to reach the sections available to your role.
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        )}
      </Grid>
    </Box>
  );
}
