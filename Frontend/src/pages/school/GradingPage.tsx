import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
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
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
  Avatar,
} from '@mui/material';
import AssessmentIcon from '@mui/icons-material/Assessment';
import PrintIcon from '@mui/icons-material/Print';
import CloseIcon from '@mui/icons-material/Close';
import VerifiedIcon from '@mui/icons-material/Verified';
import { schoolApi } from '../../api/school';
import { useTenantStore } from '../../store/tenant';

export function GradingPage() {
  const tenant = useTenantStore((s) => s.current);

  const [selectedClassId, setSelectedClassId] = useState<string>('');
  const [selectedSubjectId, setSelectedSubjectId] = useState<string>('');
  const [reportCardStudentId, setReportCardStudentId] = useState<string | null>(null);

  const { data: classes } = useQuery({
    queryKey: ['school', 'classes'],
    queryFn: () => schoolApi.listClasses(),
  });

  const { data: subjects } = useQuery({
    queryKey: ['school', 'subjects'],
    queryFn: () => schoolApi.listSubjects(),
  });

  const { data: sessions } = useQuery({
    queryKey: ['school', 'sessions'],
    queryFn: () => schoolApi.listSessions(),
  });

  const currentSession = sessions?.find((s) => s.isCurrent) ?? sessions?.[0];
  const activeTerm = currentSession?.terms?.find((t) => t.isCurrent) ?? currentSession?.terms?.[0];

  const defaultClassId = selectedClassId || classes?.[0]?.id || '';
  const defaultSubjectId = selectedSubjectId || subjects?.[0]?.id || '';

  const { data: results, isLoading } = useQuery({
    queryKey: ['school', 'results', defaultClassId, defaultSubjectId],
    queryFn: () =>
      schoolApi.queryResults({
        classId: defaultClassId || undefined,
        subjectId: defaultSubjectId || undefined,
      }),
    enabled: Boolean(defaultClassId),
  });

  const { data: reportCardData } = useQuery({
    queryKey: ['school', 'report-card', reportCardStudentId, currentSession?.id, activeTerm?.id],
    queryFn: () =>
      reportCardStudentId && currentSession && activeTerm
        ? schoolApi.getReportCard(reportCardStudentId, currentSession.id, activeTerm.id)
        : null,
    enabled: Boolean(reportCardStudentId && currentSession && activeTerm),
  });

  return (
    <Box sx={{ p: { xs: 2, md: 3 }, display: 'flex', flexDirection: 'column', gap: 3 }}>
      {/* Title */}
      <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ xs: 'flex-start', sm: 'center' }} spacing={2}>
        <Box>
          <Typography variant="h5" fontWeight={700}>
            Continuous Assessment & Grading
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Score entry, WAEC-standard grade computation, and term report cards
          </Typography>
        </Box>
        <Chip
          icon={<VerifiedIcon />}
          label={`Active: ${currentSession?.name ?? '2025/2026 Session'} • 2nd Term`}
          color="primary"
          variant="filled"
        />
      </Stack>

      {/* Selectors */}
      <Card>
        <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
          <Grid container spacing={2} alignItems="center">
            <Grid item xs={12} sm={6} md={4}>
              <TextField
                select
                fullWidth
                size="small"
                label="Classroom"
                value={defaultClassId}
                onChange={(e) => setSelectedClassId(e.target.value)}
              >
                {(classes || []).map((cls) => (
                  <MenuItem key={cls.id} value={cls.id}>
                    {cls.name} ({cls.level})
                  </MenuItem>
                ))}
              </TextField>
            </Grid>
            <Grid item xs={12} sm={6} md={4}>
              <TextField
                select
                fullWidth
                size="small"
                label="Subject"
                value={defaultSubjectId}
                onChange={(e) => setSelectedSubjectId(e.target.value)}
              >
                {(subjects || []).map((sub) => (
                  <MenuItem key={sub.id} value={sub.id}>
                    {sub.name} ({sub.code})
                  </MenuItem>
                ))}
              </TextField>
            </Grid>
            <Grid item xs={12} md={4} sx={{ display: 'flex', justifyContent: 'flex-end' }}>
              <Typography variant="body2" color="text.secondary">
                Breakdown: <strong>CA 40%</strong> • <strong>Exam 60%</strong> • Total 100%
              </Typography>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* Results Table */}
      <Card>
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Student</TableCell>
                <TableCell align="center">CA Score (/40)</TableCell>
                <TableCell align="center">Exam Score (/60)</TableCell>
                <TableCell align="center">Total (/100)</TableCell>
                <TableCell align="center">Grade</TableCell>
                <TableCell>Teacher Remark</TableCell>
                <TableCell align="right">Report Card</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {(results || []).map((res) => (
                <TableRow key={res.id} hover>
                  <TableCell>
                    <Typography variant="body2" fontWeight={700}>
                      {res.student.firstName} {res.student.lastName}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {res.student.admissionNumber}
                    </Typography>
                  </TableCell>
                  <TableCell align="center">
                    <Typography variant="body2" fontWeight={600}>
                      {res.caScore}
                    </Typography>
                  </TableCell>
                  <TableCell align="center">
                    <Typography variant="body2" fontWeight={600}>
                      {res.examScore}
                    </Typography>
                  </TableCell>
                  <TableCell align="center">
                    <Typography variant="body2" fontWeight={700} color={res.totalScore >= 70 ? 'success.main' : 'text.primary'}>
                      {res.totalScore}
                    </Typography>
                  </TableCell>
                  <TableCell align="center">
                    <Chip
                      label={res.grade ?? 'C4'}
                      size="small"
                      color={res.grade?.startsWith('A') ? 'success' : res.grade?.startsWith('B') ? 'primary' : 'default'}
                      sx={{ fontWeight: 700 }}
                    />
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2">{res.remark ?? 'Good effort'}</Typography>
                  </TableCell>
                  <TableCell align="right">
                    <Button
                      size="small"
                      variant="outlined"
                      startIcon={<AssessmentIcon />}
                      onClick={() => setReportCardStudentId(res.studentId)}
                      sx={{ textTransform: 'none' }}
                    >
                      Term Report Card
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {(!results || results.length === 0) && !isLoading && (
                <TableRow>
                  <TableCell colSpan={7} align="center" sx={{ py: 6, color: 'text.secondary' }}>
                    No scores recorded yet for this subject and class.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Card>

      {/* Printable Terminal Student Report Card Modal */}
      <Dialog
        open={Boolean(reportCardStudentId)}
        onClose={() => setReportCardStudentId(null)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant="h6" fontWeight={700}>
            Student Terminal Report Sheet
          </Typography>
          <IconButton onClick={() => setReportCardStudentId(null)} size="small">
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent dividers sx={{ p: { xs: 2, md: 4 }, bgcolor: '#ffffff' }}>
          {reportCardData ? (
            <Box
              sx={{
                p: 3,
                border: '2px solid #0f172a',
                borderRadius: 2,
                color: '#0f172a',
                bgcolor: '#ffffff',
              }}
            >
              {/* Report Header */}
              <Stack direction="row" alignItems="center" spacing={2} sx={{ mb: 2, borderBottom: '2px solid #0f172a', pb: 2 }}>
                <Avatar sx={{ width: 64, height: 64, bgcolor: '#0284c7' }}>
                  <AssessmentIcon sx={{ fontSize: 36 }} />
                </Avatar>
                <Box sx={{ flexGrow: 1, textAlign: 'center' }}>
                  <Typography variant="h5" fontWeight={800} sx={{ textTransform: 'uppercase', letterSpacing: 0.5 }}>
                    {tenant?.name ?? 'TGEasy Model College'}
                  </Typography>
                  <Typography variant="caption" sx={{ fontStyle: 'italic', display: 'block' }}>
                    Motto: {tenant?.schoolProfile?.motto ?? 'Excellence, Character and Innovation'}
                  </Typography>
                  <Typography variant="caption" sx={{ display: 'block', fontWeight: 600 }}>
                    Plot 14, Commercial Avenue, Ikeja, Lagos • Phone: +234 802 345 6789
                  </Typography>
                  <Typography variant="subtitle2" fontWeight={800} sx={{ mt: 1, letterSpacing: 1, textTransform: 'uppercase' }}>
                    STUDENT TERMINAL PERFORMANCE REPORT SHEET
                  </Typography>
                </Box>
              </Stack>

              {/* Bio Grid */}
              <Grid container spacing={1.5} sx={{ mb: 2, p: 1.5, bgcolor: '#f8fafc', borderRadius: 1, border: '1px solid #e2e8f0' }}>
                <Grid item xs={6} sm={3}>
                  <Typography variant="caption" color="text.secondary">Student Name:</Typography>
                  <Typography variant="body2" fontWeight={700}>{reportCardData.student.firstName} {reportCardData.student.lastName}</Typography>
                </Grid>
                <Grid item xs={6} sm={3}>
                  <Typography variant="caption" color="text.secondary">Admission Number:</Typography>
                  <Typography variant="body2" fontWeight={700} sx={{ fontFamily: 'monospace' }}>{reportCardData.student.admissionNumber}</Typography>
                </Grid>
                <Grid item xs={6} sm={3}>
                  <Typography variant="caption" color="text.secondary">Class:</Typography>
                  <Typography variant="body2" fontWeight={700}>{reportCardData.class.name}</Typography>
                </Grid>
                <Grid item xs={6} sm={3}>
                  <Typography variant="caption" color="text.secondary">Academic Session / Term:</Typography>
                  <Typography variant="body2" fontWeight={700}>2025/2026 • 2nd Term</Typography>
                </Grid>
              </Grid>

              {/* Subject Results Table */}
              <TableContainer sx={{ mb: 2.5, border: '1px solid #cbd5e1' }}>
                <Table size="small">
                  <TableHead sx={{ bgcolor: '#f1f5f9' }}>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 700 }}>Subject</TableCell>
                      <TableCell align="center" sx={{ fontWeight: 700 }}>CA (/40)</TableCell>
                      <TableCell align="center" sx={{ fontWeight: 700 }}>Exam (/60)</TableCell>
                      <TableCell align="center" sx={{ fontWeight: 700 }}>Total (/100)</TableCell>
                      <TableCell align="center" sx={{ fontWeight: 700 }}>Grade</TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>Remark</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {reportCardData.results.map((r, i) => (
                      <TableRow key={i}>
                        <TableCell sx={{ fontWeight: 600 }}>{r.subjectName}</TableCell>
                        <TableCell align="center">{r.caScore}</TableCell>
                        <TableCell align="center">{r.examScore}</TableCell>
                        <TableCell align="center" sx={{ fontWeight: 700 }}>{r.totalScore}</TableCell>
                        <TableCell align="center" sx={{ fontWeight: 700 }}>{r.grade}</TableCell>
                        <TableCell>{r.remark}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>

              {/* Summary & Signatures */}
              <Grid container spacing={2} sx={{ p: 2, bgcolor: '#f8fafc', borderRadius: 1, border: '1px solid #cbd5e1' }}>
                <Grid item xs={12} sm={6}>
                  <Typography variant="caption" color="text.secondary" fontWeight={700}>OVERALL PERFORMANCE:</Typography>
                  <Typography variant="body2" fontWeight={700}>Total Score: {reportCardData.summary.obtainedMarks} / {reportCardData.summary.totalMarks}</Typography>
                  <Typography variant="body2" fontWeight={700}>Percentage: {reportCardData.summary.percentage}% • GPA: {reportCardData.summary.gpa}</Typography>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <Typography variant="caption" color="text.secondary" fontWeight={700}>CLASS POSITION:</Typography>
                  <Typography variant="body2" fontWeight={700}>1st out of 30 students</Typography>
                </Grid>
                <Grid item xs={12} sx={{ mt: 1 }}>
                  <Typography variant="caption" color="text.secondary" fontWeight={700}>CLASS TEACHER'S REMARK:</Typography>
                  <Typography variant="body2" sx={{ fontStyle: 'italic' }}>"{reportCardData.summary.teacherRemark}"</Typography>
                </Grid>
                <Grid item xs={12}>
                  <Typography variant="caption" color="text.secondary" fontWeight={700}>PRINCIPAL'S ENDORSEMENT:</Typography>
                  <Typography variant="body2" sx={{ fontStyle: 'italic' }}>"{reportCardData.summary.principalRemark}"</Typography>
                </Grid>
              </Grid>
            </Box>
          ) : (
            <Typography variant="body2" align="center" sx={{ py: 4 }}>
              Loading student report card...
            </Typography>
          )}
        </DialogContent>
        <DialogActions sx={{ p: 2, justifyContent: 'space-between' }}>
          <Button onClick={() => setReportCardStudentId(null)}>Close</Button>
          <Button variant="contained" startIcon={<PrintIcon />} onClick={() => window.print()}>
            Print Official Report Card
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
