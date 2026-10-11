import { useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  Alert,
  Avatar,
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
  IconButton,
  MenuItem,
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
  Typography,
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import PrintIcon from '@mui/icons-material/Print';
import CloseIcon from '@mui/icons-material/Close';
import AssessmentIcon from '@mui/icons-material/Assessment';
import { parentApi } from '../../api/parent';
import { schoolApi } from '../../api/school';
import { useTenantStore } from '../../store/tenant';
import { tenantLogoUrl, apiErrorMessage } from '../../api/client';

function formatDate(value?: string | null) {
  if (!value) return '—';
  const d = new Date(value);
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

function currency(amount: number, code = 'NGN') {
  return new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency: code,
    maximumFractionDigits: 2,
  }).format(amount);
}

export function ChildDetailPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const tenant = useTenantStore((s) => s.current);
  const tenantLogo = tenantLogoUrl(tenant?.id, tenant?.logoKey);
  const [tab, setTab] = useState(0);
  const [sessionId, setSessionId] = useState('');
  const [termId, setTermId] = useState('');
  const [reportOpen, setReportOpen] = useState(false);

  const { data: child } = useQuery({
    queryKey: ['parent', 'child', id],
    queryFn: () => parentApi.child(id),
    enabled: Boolean(id),
  });

  const { data: sessions } = useQuery({
    queryKey: ['school', 'sessions'],
    queryFn: () => schoolApi.listSessions(),
  });

  const currentSession = sessions?.find((s) => s.isCurrent) ?? sessions?.[0];
  const activeTerm = currentSession?.terms?.find((t) => t.isCurrent) ?? currentSession?.terms?.[0];
  const effectiveSessionId = sessionId || currentSession?.id || '';
  const effectiveTermId = termId || activeTerm?.id || '';
  const effectiveSession = sessions?.find((s) => s.id === effectiveSessionId);
  const termOptions = effectiveSession?.terms ?? [];

  const { data: attendance } = useQuery({
    queryKey: ['parent', 'attendance', id],
    queryFn: () => parentApi.attendance(id),
    enabled: Boolean(id) && tab === 0,
  });

  const { data: results } = useQuery({
    queryKey: ['parent', 'results', id, effectiveSessionId, effectiveTermId],
    queryFn: () => parentApi.results(id, { sessionId: effectiveSessionId, termId: effectiveTermId }),
    enabled: Boolean(id) && tab === 1,
  });

  const { data: invoices } = useQuery({
    queryKey: ['parent', 'invoices', id],
    queryFn: () => parentApi.invoices(id),
    enabled: Boolean(id) && tab === 2,
  });

  const { data: reportCard, isError: reportError, error: reportCardError } = useQuery({
    queryKey: ['parent', 'report-card', id, effectiveSessionId, effectiveTermId],
    queryFn: () => parentApi.reportCard(id, effectiveSessionId, effectiveTermId),
    enabled: reportOpen && Boolean(id && effectiveSessionId && effectiveTermId),
    retry: false,
  });

  const attendanceRate = useMemo(() => {
    if (!attendance || attendance.length === 0) return null;
    const present = attendance.filter((a) => a.status === 'PRESENT' || a.status === 'LATE').length;
    return Math.round((present / attendance.length) * 100);
  }, [attendance]);

  const handlePrint = () => {
    document.body.classList.add('printing-report-card');
    const cleanup = () => {
      document.body.classList.remove('printing-report-card');
      window.removeEventListener('afterprint', cleanup);
    };
    window.addEventListener('afterprint', cleanup);
    window.print();
    setTimeout(cleanup, 1500);
  };

  const outstanding = (invoices ?? []).reduce((acc, inv) => acc + (inv.balance ?? 0), 0);

  return (
    <Box sx={{ p: { xs: 2, md: 3 }, display: 'flex', flexDirection: 'column', gap: 3 }}>
      <Stack direction="row" spacing={1} alignItems="center">
        <IconButton onClick={() => navigate('/parent')}>
          <ArrowBackIcon />
        </IconButton>
        <Typography variant="h5" fontWeight={700}>
          {child ? `${child.firstName} ${child.lastName}` : 'Child'}
        </Typography>
        {child && (
          <Chip label={child.currentClass?.name ?? 'Unassigned'} color="primary" size="small" />
        )}
      </Stack>

      <Card>
        <CardContent>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={3} alignItems="center">
            <Avatar
              src={child?.passportPhoto ?? undefined}
              sx={{ width: 80, height: 80, bgcolor: 'secondary.main', fontSize: 28 }}
            >
              {child?.firstName?.[0]}
              {child?.lastName?.[0]}
            </Avatar>
            <Grid container spacing={2} sx={{ flexGrow: 1 }}>
              <Grid item xs={6} sm={3}>
                <Typography variant="caption" color="text.secondary">
                  Admission Number
                </Typography>
                <Typography variant="body2" fontWeight={700} sx={{ fontFamily: 'monospace' }}>
                  {child?.admissionNumber ?? '—'}
                </Typography>
              </Grid>
              <Grid item xs={6} sm={3}>
                <Typography variant="caption" color="text.secondary">
                  Class
                </Typography>
                <Typography variant="body2" fontWeight={700}>
                  {child?.currentClass?.name ?? '—'}
                </Typography>
              </Grid>
              <Grid item xs={6} sm={3}>
                <Typography variant="caption" color="text.secondary">
                  Attendance Rate
                </Typography>
                <Typography variant="body2" fontWeight={700}>
                  {attendanceRate != null ? `${attendanceRate}%` : '—'}
                </Typography>
              </Grid>
              <Grid item xs={6} sm={3}>
                <Typography variant="caption" color="text.secondary">
                  Outstanding Fees
                </Typography>
                <Typography variant="body2" fontWeight={700} color={outstanding > 0 ? 'error.main' : 'success.main'}>
                  {currency(outstanding, (tenant?.schoolProfile as any)?.currency ?? 'NGN')}
                </Typography>
              </Grid>
            </Grid>
          </Stack>
        </CardContent>
      </Card>

      <Tabs value={tab} onChange={(_e, v) => setTab(v)} variant="scrollable" allowScrollButtonsMobile>
        <Tab label="Attendance" />
        <Tab label="Results" />
        <Tab label="Fees & Invoices" />
      </Tabs>

      {tab === 0 && (
        <Card>
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Date</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Check-in</TableCell>
                  <TableCell>Check-out</TableCell>
                  <TableCell>Method</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {(attendance ?? []).map((a) => (
                  <TableRow key={a.id} hover>
                    <TableCell>{formatDate(a.date)}</TableCell>
                    <TableCell>
                      <Chip
                        label={a.status}
                        size="small"
                        color={
                          a.status === 'PRESENT'
                            ? 'success'
                            : a.status === 'LATE'
                              ? 'warning'
                              : a.status === 'ABSENT'
                                ? 'error'
                                : 'default'
                        }
                      />
                    </TableCell>
                    <TableCell>
                      {a.checkInTime ? new Date(a.checkInTime).toLocaleTimeString() : '—'}
                    </TableCell>
                    <TableCell>
                      {a.checkOutTime ? new Date(a.checkOutTime).toLocaleTimeString() : '—'}
                    </TableCell>
                    <TableCell>{a.method}</TableCell>
                  </TableRow>
                ))}
                {(attendance ?? []).length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} align="center" sx={{ py: 5, color: 'text.secondary' }}>
                      No attendance records yet.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </Card>
      )}

      {tab === 1 && (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems={{ xs: 'stretch', sm: 'center' }}>
            <TextField
              select
              size="small"
              label="Session"
              value={effectiveSessionId}
              onChange={(e) => {
                setSessionId(e.target.value);
                setTermId('');
              }}
              sx={{ minWidth: 180 }}
            >
              {(sessions ?? []).map((s) => (
                <MenuItem key={s.id} value={s.id}>
                  {s.name}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              select
              size="small"
              label="Term"
              value={effectiveTermId}
              onChange={(e) => setTermId(e.target.value)}
              sx={{ minWidth: 180 }}
            >
              {termOptions.map((t) => (
                <MenuItem key={t.id} value={t.id}>
                  {t.name}
                </MenuItem>
              ))}
            </TextField>
            <Button
              variant="contained"
              startIcon={<AssessmentIcon />}
              disabled={!effectiveSessionId || !effectiveTermId}
              onClick={() => setReportOpen(true)}
              sx={{ textTransform: 'none' }}
            >
              View Report Card
            </Button>
          </Stack>

          <Card>
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Subject</TableCell>
                    <TableCell align="center">CA</TableCell>
                    <TableCell align="center">Exam</TableCell>
                    <TableCell align="center">Total</TableCell>
                    <TableCell align="center">Grade</TableCell>
                    <TableCell>Remark</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {(results ?? []).map((r) => (
                    <TableRow key={r.id} hover>
                      <TableCell>
                        <Typography variant="body2" fontWeight={700}>
                          {r.subject.name}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {r.subject.code}
                        </Typography>
                      </TableCell>
                      <TableCell align="center">{r.caScore}</TableCell>
                      <TableCell align="center">{r.examScore}</TableCell>
                      <TableCell align="center">
                        <Typography variant="body2" fontWeight={700}>
                          {r.totalScore}
                        </Typography>
                      </TableCell>
                      <TableCell align="center">
                        <Chip label={r.grade ?? '—'} size="small" color={r.grade?.startsWith('A') ? 'success' : 'default'} />
                      </TableCell>
                      <TableCell>{r.remark ?? '—'}</TableCell>
                    </TableRow>
                  ))}
                  {(results ?? []).length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6} align="center" sx={{ py: 5, color: 'text.secondary' }}>
                        No published results for this session and term yet.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          </Card>
        </Box>
      )}

      {tab === 2 && (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {(invoices ?? []).map((inv) => (
            <Card key={inv.id}>
              <CardContent>
                <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" spacing={2}>
                  <Box>
                    <Typography variant="subtitle1" fontWeight={700}>
                      {inv.invoiceNumber ?? 'Invoice'}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {inv.session?.name ?? ''} {inv.term?.name ? `• ${inv.term.name}` : ''} • Due {formatDate(inv.dueDate)}
                    </Typography>
                  </Box>
                  <Stack direction="row" spacing={2} alignItems="center">
                    <Box textAlign="right">
                      <Typography variant="caption" color="text.secondary">
                        Amount
                      </Typography>
                      <Typography variant="body2" fontWeight={700}>
                        {currency(inv.totalAmount, (tenant?.schoolProfile as any)?.currency ?? 'NGN')}
                      </Typography>
                    </Box>
                    <Box textAlign="right">
                      <Typography variant="caption" color="text.secondary">
                        Balance
                      </Typography>
                      <Typography variant="body2" fontWeight={700} color={inv.balance > 0 ? 'error.main' : 'success.main'}>
                        {currency(inv.balance, (tenant?.schoolProfile as any)?.currency ?? 'NGN')}
                      </Typography>
                    </Box>
                    <Chip
                      label={inv.status}
                      color={inv.status === 'PAID' ? 'success' : inv.status === 'PARTIAL' ? 'warning' : 'error'}
                    />
                  </Stack>
                </Stack>

                {(inv.items?.length ?? 0) > 0 && (
                  <TableContainer sx={{ mt: 2 }}>
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell>Fee Item</TableCell>
                          <TableCell align="right">Amount</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {inv.items!.map((item) => (
                          <TableRow key={item.id}>
                            <TableCell>{item.description}</TableCell>
                            <TableCell align="right">
                              {currency(item.amount, (tenant?.schoolProfile as any)?.currency ?? 'NGN')}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                )}

                {(inv.payments?.length ?? 0) > 0 && (
                  <Box sx={{ mt: 1 }}>
                    <Typography variant="caption" color="text.secondary">
                      Payments
                    </Typography>
                    <Stack spacing={0.5} sx={{ mt: 0.5 }}>
                      {inv.payments!.map((p) => (
                        <Stack key={p.id} direction="row" justifyContent="space-between">
                          <Typography variant="body2">
                            {p.receiptNumber} • {formatDate(p.paymentDate)}
                          </Typography>
                          <Typography variant="body2" fontWeight={600}>
                            {currency(p.amount, (tenant?.schoolProfile as any)?.currency ?? 'NGN')}
                          </Typography>
                        </Stack>
                      ))}
                    </Stack>
                  </Box>
                )}
              </CardContent>
            </Card>
          ))}
          {(invoices ?? []).length === 0 && (
            <Alert severity="info">No invoices have been issued for this child yet.</Alert>
          )}
        </Box>
      )}

      {/* Printable report card */}
      <Dialog open={reportOpen} onClose={() => setReportOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant="h6" fontWeight={700}>
            Terminal Report Sheet
          </Typography>
          <IconButton onClick={() => setReportOpen(false)} size="small">
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent dividers sx={{ p: { xs: 2, md: 4 }, bgcolor: '#ffffff' }}>
          {reportError ? (
            <Alert severity="warning">
              {apiErrorMessage(reportCardError) ||
                'This report card is not available yet. Results must be published by the school first.'}
            </Alert>
          ) : reportCard ? (
            <Box
              id="report-card-print"
              sx={{ p: 3, border: '2px solid #0f172a', borderRadius: 2, color: '#0f172a', bgcolor: '#ffffff' }}
            >
              <Stack direction="row" alignItems="center" spacing={2} sx={{ mb: 2, borderBottom: '2px solid #0f172a', pb: 2 }}>
                <Avatar src={tenantLogo ?? undefined} variant="rounded" sx={{ width: 64, height: 64, bgcolor: '#0284c7' }}>
                  <AssessmentIcon sx={{ fontSize: 36 }} />
                </Avatar>
                <Box sx={{ flexGrow: 1, textAlign: 'center' }}>
                  <Typography variant="h5" fontWeight={800} sx={{ textTransform: 'uppercase' }}>
                    {tenant?.name ?? 'School'}
                  </Typography>
                  <Typography variant="subtitle2" fontWeight={800} sx={{ mt: 1, letterSpacing: 1 }}>
                    STUDENT TERMINAL PERFORMANCE REPORT SHEET
                  </Typography>
                </Box>
              </Stack>

              <Grid container spacing={1.5} sx={{ mb: 2, p: 1.5, bgcolor: '#f8fafc', borderRadius: 1 }}>
                <Grid item xs={6} sm={3}>
                  <Typography variant="caption" color="text.secondary">Student:</Typography>
                  <Typography variant="body2" fontWeight={700}>{reportCard.student.fullName}</Typography>
                </Grid>
                <Grid item xs={6} sm={3}>
                  <Typography variant="caption" color="text.secondary">Admission No:</Typography>
                  <Typography variant="body2" fontWeight={700}>{reportCard.student.admissionNumber}</Typography>
                </Grid>
                <Grid item xs={6} sm={3}>
                  <Typography variant="caption" color="text.secondary">Class:</Typography>
                  <Typography variant="body2" fontWeight={700}>
                    {reportCard.class?.name ?? reportCard.student.className}
                  </Typography>
                </Grid>
                <Grid item xs={6} sm={3}>
                  <Typography variant="caption" color="text.secondary">Session / Term:</Typography>
                  <Typography variant="body2" fontWeight={700}>
                    {reportCard.session} • {reportCard.term}
                  </Typography>
                </Grid>
              </Grid>

              <TableContainer sx={{ mb: 2, border: '1px solid #cbd5e1' }}>
                <Table size="small">
                  <TableHead sx={{ bgcolor: '#f1f5f9' }}>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 700 }}>Subject</TableCell>
                      <TableCell align="center" sx={{ fontWeight: 700 }}>CA</TableCell>
                      <TableCell align="center" sx={{ fontWeight: 700 }}>Exam</TableCell>
                      <TableCell align="center" sx={{ fontWeight: 700 }}>Total</TableCell>
                      <TableCell align="center" sx={{ fontWeight: 700 }}>Grade</TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>Remark</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {reportCard.results.map((r, i) => (
                      <TableRow key={i}>
                        <TableCell sx={{ fontWeight: 600 }}>{r.subjectName}</TableCell>
                        <TableCell align="center">{r.caScore}</TableCell>
                        <TableCell align="center">{r.examScore}</TableCell>
                        <TableCell align="center" sx={{ fontWeight: 700 }}>{r.totalScore}</TableCell>
                        <TableCell align="center" sx={{ fontWeight: 700 }}>{r.grade ?? '—'}</TableCell>
                        <TableCell>{r.remark ?? '—'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>

              <Grid container spacing={2} sx={{ p: 2, bgcolor: '#f8fafc', borderRadius: 1 }}>
                <Grid item xs={12} sm={6}>
                  <Typography variant="body2" fontWeight={700}>
                    Total: {reportCard.summary.obtainedMarks} / {reportCard.summary.totalMarks}
                  </Typography>
                  <Typography variant="body2" fontWeight={700}>
                    Percentage: {reportCard.summary.percentage}% • GPA: {reportCard.summary.gpa}
                  </Typography>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <Typography variant="body2" fontWeight={700}>
                    Position:{' '}
                    {reportCard.summary.position
                      ? `${reportCard.summary.position} of ${reportCard.summary.totalInClass}`
                      : 'Not ranked'}
                  </Typography>
                </Grid>
                <Grid item xs={12}>
                  <Typography variant="caption" color="text.secondary" fontWeight={700}>
                    CLASS TEACHER'S REMARK:
                  </Typography>
                  <Typography variant="body2" sx={{ fontStyle: 'italic' }}>
                    "{reportCard.summary.teacherRemark}"
                  </Typography>
                </Grid>
                <Grid item xs={12}>
                  <Typography variant="caption" color="text.secondary" fontWeight={700}>
                    PRINCIPAL'S ENDORSEMENT:
                  </Typography>
                  <Typography variant="body2" sx={{ fontStyle: 'italic' }}>
                    "{reportCard.summary.principalRemark}"
                  </Typography>
                </Grid>
              </Grid>
            </Box>
          ) : (
            <Typography variant="body2" align="center" sx={{ py: 4 }}>
              Loading report card...
            </Typography>
          )}
        </DialogContent>
        <DialogActions sx={{ p: 2, justifyContent: 'space-between' }}>
          <Button onClick={() => setReportOpen(false)}>Close</Button>
          <Button variant="contained" startIcon={<PrintIcon />} onClick={handlePrint} disabled={!reportCard}>
            Print / Save as PDF
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
