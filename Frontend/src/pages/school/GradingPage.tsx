import { useMemo, useState } from 'react';
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
import EditNoteIcon from '@mui/icons-material/EditNote';
import DoneAllIcon from '@mui/icons-material/DoneAll';
import PublishIcon from '@mui/icons-material/Publish';
import TableChartIcon from '@mui/icons-material/TableChart';
import { schoolApi } from '../../api/school';
import { useTenantStore } from '../../store/tenant';
import { tenantLogoUrl } from '../../api/client';

interface ScoreDraft {
  caScore: string;
  examScore: string;
}

export function GradingPage() {
  const qc = useQueryClient();
  const tenant = useTenantStore((s) => s.current);
  const tenantLogo = tenantLogoUrl(tenant?.id, tenant?.logoKey);

  const [selectedClassId, setSelectedClassId] = useState<string>('');
  const [selectedSubjectId, setSelectedSubjectId] = useState<string>('');
  const [reportCardStudentId, setReportCardStudentId] = useState<string | null>(null);
  const [scoreEntryOpen, setScoreEntryOpen] = useState(false);
  const [classSheetOpen, setClassSheetOpen] = useState(false);
  const [scoreDraft, setScoreDraft] = useState<Record<string, ScoreDraft>>({});
  const [feedback, setFeedback] = useState<{ severity: 'success' | 'error'; text: string } | null>(null);

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

  const resultsList = Array.isArray(results)
    ? results
    : Array.isArray((results as any)?.items)
      ? (results as any).items
      : [];

  const { data: studentsData } = useQuery({
    queryKey: ['school', 'students', defaultClassId],
    queryFn: () => schoolApi.listStudents({ classId: defaultClassId, limit: 200 }),
    enabled: scoreEntryOpen && Boolean(defaultClassId),
  });

  const { data: reportCardData } = useQuery({
    queryKey: ['school', 'report-card', reportCardStudentId, currentSession?.id, activeTerm?.id],
    queryFn: () =>
      reportCardStudentId && currentSession && activeTerm
        ? schoolApi.getReportCard(reportCardStudentId, currentSession.id, activeTerm.id)
        : null,
    enabled: Boolean(reportCardStudentId && currentSession && activeTerm),
  });

  const { data: classSheet, isLoading: classSheetLoading } = useQuery({
    queryKey: ['school', 'class-sheet', defaultClassId, currentSession?.id, activeTerm?.id],
    queryFn: () =>
      schoolApi.getClassResultsSheet({
        classId: defaultClassId,
        sessionId: currentSession!.id,
        termId: activeTerm!.id,
      }),
    enabled: classSheetOpen && Boolean(defaultClassId && currentSession && activeTerm),
  });

  const recordMutation = useMutation({
    mutationFn: () => {
      if (!currentSession || !activeTerm) throw new Error('No active session or term');
      const scores = Object.entries(scoreDraft).map(([studentId, v]) => ({
        studentId,
        caScore: v.caScore === '' ? 0 : Number(v.caScore),
        examScore: v.examScore === '' ? 0 : Number(v.examScore),
      }));
      return schoolApi.recordResults({
        sessionId: currentSession.id,
        termId: activeTerm.id,
        classId: defaultClassId,
        subjectId: defaultSubjectId,
        scores,
      });
    },
    onSuccess: () => {
      setScoreEntryOpen(false);
      setFeedback({ severity: 'success', text: 'Scores recorded and grades computed.' });
      qc.invalidateQueries({ queryKey: ['school', 'results'] });
      qc.invalidateQueries({ queryKey: ['school', 'class-sheet'] });
    },
    onError: (e: any) =>
      setFeedback({
        severity: 'error',
        text: e?.response?.data?.message ?? e?.message ?? 'Failed to record scores',
      }),
  });

  const approveMutation = useMutation({
    mutationFn: (action: 'APPROVE' | 'PUBLISH') => {
      if (!currentSession || !activeTerm) throw new Error('No active session or term');
      return schoolApi.approveResults({
        sessionId: currentSession.id,
        termId: activeTerm.id,
        classId: defaultClassId,
        action,
      });
    },
    onSuccess: (_data, action) => {
      setFeedback({
        severity: 'success',
        text:
          action === 'PUBLISH'
            ? 'Results published and term locked.'
            : 'Results approved.',
      });
      qc.invalidateQueries({ queryKey: ['school', 'results'] });
      qc.invalidateQueries({ queryKey: ['school', 'class-sheet'] });
      qc.invalidateQueries({ queryKey: ['school', 'sessions'] });
    },
    onError: (e: any) =>
      setFeedback({
        severity: 'error',
        text: e?.response?.data?.message ?? e?.message ?? 'Action failed',
      }),
  });

  const openScoreEntry = () => {
    const draft: Record<string, ScoreDraft> = {};
    for (const r of resultsList) {
      draft[r.studentId] = {
        caScore: r.caScore != null ? String(r.caScore) : '',
        examScore: r.examScore != null ? String(r.examScore) : '',
      };
    }
    setScoreDraft(draft);
    setFeedback(null);
    setScoreEntryOpen(true);
  };

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

  const studentRows = useMemo(() => studentsData?.items ?? [], [studentsData]);

  return (
    <Box sx={{ p: { xs: 2, md: 3 }, display: 'flex', flexDirection: 'column', gap: 3 }}>
      {/* Title */}
      <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ xs: 'flex-start', sm: 'center' }} spacing={2}>
        <Box>
          <Typography variant="h5" fontWeight={700}>
            Continuous Assessment & Grading
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Score entry, WAEC-standard grade computation, results publishing and term report cards
          </Typography>
        </Box>
        <Chip
          icon={<VerifiedIcon />}
          label={`Active: ${currentSession?.name ?? '—'} • ${activeTerm?.name ?? '—'}`}
          color="primary"
          variant="filled"
        />
      </Stack>

      {feedback && (
        <Alert severity={feedback.severity} onClose={() => setFeedback(null)}>
          {feedback.text}
        </Alert>
      )}

      {/* Selectors */}
      <Card>
        <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
          <Grid container spacing={2} alignItems="center">
            <Grid item xs={12} sm={6} md={3}>
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
            <Grid item xs={12} sm={6} md={3}>
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
            <Grid item xs={12} md={6}>
              <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap justifyContent={{ xs: 'flex-start', md: 'flex-end' }}>
                <Button
                  variant="contained"
                  startIcon={<EditNoteIcon />}
                  disabled={!defaultClassId || !defaultSubjectId}
                  onClick={openScoreEntry}
                  sx={{ textTransform: 'none' }}
                >
                  Enter Scores
                </Button>
                <Button
                  variant="outlined"
                  startIcon={<TableChartIcon />}
                  disabled={!defaultClassId || !currentSession || !activeTerm}
                  onClick={() => setClassSheetOpen(true)}
                  sx={{ textTransform: 'none' }}
                >
                  Class Sheet
                </Button>
                <Button
                  variant="outlined"
                  color="success"
                  startIcon={<DoneAllIcon />}
                  disabled={!defaultClassId || !currentSession || !activeTerm || approveMutation.isPending}
                  onClick={() => approveMutation.mutate('APPROVE')}
                  sx={{ textTransform: 'none' }}
                >
                  Approve
                </Button>
                <Button
                  variant="contained"
                  color="success"
                  startIcon={<PublishIcon />}
                  disabled={!defaultClassId || !currentSession || !activeTerm || approveMutation.isPending}
                  onClick={() => approveMutation.mutate('PUBLISH')}
                  sx={{ textTransform: 'none' }}
                >
                  Publish
                </Button>
              </Stack>
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
              {resultsList.map((res: any) => (
                <TableRow key={res.id} hover>
                  <TableCell>
                    <Typography variant="body2" fontWeight={700}>
                      {res.student?.firstName ?? 'Student'} {res.student?.lastName ?? ''}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {res.student?.admissionNumber ?? '—'}
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
                      label={res.grade ?? '—'}
                      size="small"
                      color={res.grade?.startsWith('A') ? 'success' : res.grade?.startsWith('B') ? 'primary' : 'default'}
                      sx={{ fontWeight: 700 }}
                    />
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2">{res.remark ?? '—'}</Typography>
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
              {resultsList.length === 0 && !isLoading && (
                <TableRow>
                  <TableCell colSpan={7} align="center" sx={{ py: 6, color: 'text.secondary' }}>
                    No scores recorded yet for this subject and class. Use “Enter Scores” to add them.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Card>

      {/* Score entry dialog */}
      <Dialog open={scoreEntryOpen} onClose={() => setScoreEntryOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>Enter Scores — {activeTerm?.name ?? ''}</DialogTitle>
        <DialogContent dividers>
          {studentRows.length === 0 ? (
            <Typography variant="body2" color="text.secondary" sx={{ py: 3 }} align="center">
              No students enrolled in this class yet.
            </Typography>
          ) : (
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Student</TableCell>
                    <TableCell align="center">CA (/40)</TableCell>
                    <TableCell align="center">Exam (/60)</TableCell>
                    <TableCell align="center">Total</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {studentRows.map((s) => {
                    const draft = scoreDraft[s.id] ?? { caScore: '', examScore: '' };
                    const total =
                      (draft.caScore === '' ? 0 : Number(draft.caScore)) +
                      (draft.examScore === '' ? 0 : Number(draft.examScore));
                    return (
                      <TableRow key={s.id}>
                        <TableCell>
                          <Typography variant="body2" fontWeight={600}>
                            {s.firstName} {s.lastName}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {s.admissionNumber}
                          </Typography>
                        </TableCell>
                        <TableCell align="center">
                          <TextField
                            size="small"
                            type="number"
                            value={draft.caScore}
                            inputProps={{ min: 0, max: 40, style: { textAlign: 'center' } }}
                            onChange={(e) =>
                              setScoreDraft((prev) => ({
                                ...prev,
                                [s.id]: { ...draft, caScore: e.target.value },
                              }))
                            }
                            sx={{ width: 90 }}
                          />
                        </TableCell>
                        <TableCell align="center">
                          <TextField
                            size="small"
                            type="number"
                            value={draft.examScore}
                            inputProps={{ min: 0, max: 60, style: { textAlign: 'center' } }}
                            onChange={(e) =>
                              setScoreDraft((prev) => ({
                                ...prev,
                                [s.id]: { ...draft, examScore: e.target.value },
                              }))
                            }
                            sx={{ width: 90 }}
                          />
                        </TableCell>
                        <TableCell align="center">
                          <Chip
                            label={total}
                            size="small"
                            color={total >= 70 ? 'success' : total < 40 ? 'error' : 'default'}
                          />
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setScoreEntryOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            disabled={recordMutation.isPending || studentRows.length === 0}
            onClick={() => recordMutation.mutate()}
          >
            {recordMutation.isPending ? 'Saving…' : 'Save & Compute Grades'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Class results sheet dialog */}
      <Dialog open={classSheetOpen} onClose={() => setClassSheetOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Box>
            <Typography variant="h6" fontWeight={700}>
              Class Results Sheet
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {classSheet ? `${classSheet.class.name} • ${classSheet.session} • ${classSheet.term}` : 'Loading…'}
            </Typography>
          </Box>
          <IconButton onClick={() => setClassSheetOpen(false)} size="small">
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent dividers>
          {classSheetLoading ? (
            <Typography variant="body2" align="center" sx={{ py: 4 }}>
              Loading class results…
            </Typography>
          ) : !classSheet || classSheet.students.length === 0 ? (
            <Typography variant="body2" color="text.secondary" align="center" sx={{ py: 4 }}>
              No results recorded for this class and term yet.
            </Typography>
          ) : (
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Pos.</TableCell>
                    <TableCell>Student</TableCell>
                    <TableCell align="center">Subjects</TableCell>
                    <TableCell align="center">Obtained</TableCell>
                    <TableCell align="center">Average</TableCell>
                    <TableCell align="center">Status</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {classSheet.students.map((row) => (
                    <TableRow key={row.studentId} hover>
                      <TableCell>
                        <Chip label={row.position} size="small" />
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" fontWeight={600}>
                          {row.name}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {row.admissionNumber}
                        </Typography>
                      </TableCell>
                      <TableCell align="center">{row.subjectsCount}</TableCell>
                      <TableCell align="center">
                        {row.obtained} / {row.possible}
                      </TableCell>
                      <TableCell align="center">
                        <Chip
                          label={`${row.average}%`}
                          size="small"
                          color={row.average >= 60 ? 'success' : row.average < 40 ? 'error' : 'default'}
                        />
                      </TableCell>
                      <TableCell align="center">
                        <Chip
                          label={row.status}
                          size="small"
                          color={
                            row.status === 'PUBLISHED'
                              ? 'success'
                              : row.status === 'APPROVED'
                                ? 'primary'
                                : 'default'
                          }
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setClassSheetOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>

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
              id="report-card-print"
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
                <Avatar
                  src={tenantLogo ?? undefined}
                  variant="rounded"
                  sx={{ width: 64, height: 64, bgcolor: '#0284c7', p: tenantLogo ? 0.5 : 0 }}
                >
                  <AssessmentIcon sx={{ fontSize: 36 }} />
                </Avatar>
                <Box sx={{ flexGrow: 1, textAlign: 'center' }}>
                  <Typography variant="h5" fontWeight={800} sx={{ textTransform: 'uppercase', letterSpacing: 0.5 }}>
                    {tenant?.name ?? 'School Workspace'}
                  </Typography>
                  <Typography variant="caption" sx={{ fontStyle: 'italic', display: 'block' }}>
                    Motto: {tenant?.schoolProfile?.motto ?? 'Excellence, Character and Innovation'}
                  </Typography>
                  <Typography variant="caption" sx={{ display: 'block', fontWeight: 600 }}>
                    {[
                      (tenant?.schoolProfile as any)?.address,
                      (tenant?.schoolProfile as any)?.city,
                      (tenant?.schoolProfile as any)?.state,
                    ]
                      .filter(Boolean)
                      .join(', ') || '—'}
                    {(tenant?.schoolProfile as any)?.phone ? ` • Phone: ${(tenant?.schoolProfile as any).phone}` : ''}
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
                  <Typography variant="body2" fontWeight={700}>{reportCardData.student.fullName}</Typography>
                </Grid>
                <Grid item xs={6} sm={3}>
                  <Typography variant="caption" color="text.secondary">Admission Number:</Typography>
                  <Typography variant="body2" fontWeight={700} sx={{ fontFamily: 'monospace' }}>{reportCardData.student.admissionNumber}</Typography>
                </Grid>
                <Grid item xs={6} sm={3}>
                  <Typography variant="caption" color="text.secondary">Class:</Typography>
                  <Typography variant="body2" fontWeight={700}>
                    {reportCardData.class?.name ?? reportCardData.student.className}
                  </Typography>
                </Grid>
                <Grid item xs={6} sm={3}>
                  <Typography variant="caption" color="text.secondary">Academic Session / Term:</Typography>
                  <Typography variant="body2" fontWeight={700}>
                    {reportCardData.session} • {reportCardData.term}
                  </Typography>
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
                      <TableCell align="center" sx={{ fontWeight: 700 }}>Class Avg</TableCell>
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
                        <TableCell align="center">{r.classAverage ?? '—'}</TableCell>
                        <TableCell align="center" sx={{ fontWeight: 700 }}>{r.grade ?? '—'}</TableCell>
                        <TableCell>{r.remark ?? '—'}</TableCell>
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
                  <Typography variant="body2" fontWeight={700}>
                    {reportCardData.summary.position
                      ? `${reportCardData.summary.position} of ${reportCardData.summary.totalInClass} students`
                      : 'Not ranked'}
                  </Typography>
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
          <Button variant="contained" startIcon={<PrintIcon />} onClick={handlePrint} disabled={!reportCardData}>
            Print / Save as PDF
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
