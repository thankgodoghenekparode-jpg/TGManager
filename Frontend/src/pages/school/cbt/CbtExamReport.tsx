import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Grid,
  LinearProgress,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material';
import { useNavigate, useParams } from 'react-router-dom';
import { cbtApi, CBT_CATEGORY_LABELS } from '../../../api/cbt';
import { apiErrorMessage } from '../../../api/client';
import { CATEGORY_COLORS, formatDate, formatSeconds, modeLabel, scoreColor } from './cbtUi';

export function CbtExamReportPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const [page, setPage] = useState(1);

  const { data, isLoading, error } = useQuery({
    queryKey: ['cbt', 'exam-report', id, page],
    queryFn: () => cbtApi.examReport({ examId: id, page, limit: 25 }),
    enabled: !!id,
  });

  if (isLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error || !data) {
    return <Alert severity="error">{apiErrorMessage(error) || 'Report not available'}</Alert>;
  }

  const { exam, items, stats } = data;
  const totalPages = Math.max(1, Math.ceil(data.total / data.limit));

  return (
    <Box>
      <Stack direction="row" spacing={2} sx={{ mb: 2 }} alignItems="center">
        <Button onClick={() => navigate('/school/cbt/exams')}>← Examinations</Button>
      </Stack>

      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        justifyContent="space-between"
        alignItems={{ xs: 'flex-start', sm: 'center' }}
        spacing={1}
        sx={{ mb: 2 }}
      >
        <Box>
          <Typography variant="h5" fontWeight={700}>
            {exam.title}
          </Typography>
          <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 0.5 }}>
            <Chip
              size="small"
              variant="outlined"
              color={CATEGORY_COLORS[exam.category] as any}
              label={CBT_CATEGORY_LABELS[exam.category]}
            />
            <Typography variant="caption" color="text.secondary">
              {exam.subject?.name ?? 'General'} • {modeLabel(exam.mode)} • {exam._count.questions}{' '}
              questions • Pass mark {exam.passMark}%
            </Typography>
          </Stack>
        </Box>
        <Button variant="outlined" onClick={() => navigate(`/school/cbt/performance`)}>
          All-student performance
        </Button>
      </Stack>

      <Grid container spacing={2} sx={{ mb: 2 }}>
        <Grid item xs={6} sm={4} md={2}>
          <Kpi label="Attempts" value={String(stats.attempts)} />
        </Grid>
        <Grid item xs={6} sm={4} md={2}>
          <Kpi label="Students" value={String(stats.students)} />
        </Grid>
        <Grid item xs={6} sm={4} md={2}>
          <Kpi label="Average" value={`${stats.averageScore}%`} />
        </Grid>
        <Grid item xs={6} sm={4} md={2}>
          <Kpi label="Highest" value={`${stats.highestScore}%`} />
        </Grid>
        <Grid item xs={6} sm={4} md={2}>
          <Kpi label="Lowest" value={`${stats.lowestScore}%`} />
        </Grid>
        <Grid item xs={6} sm={4} md={2}>
          <Kpi label="Pass rate" value={`${stats.passRate}%`} />
        </Grid>
      </Grid>

      <Grid container spacing={2} sx={{ mb: 2 }}>
        <Grid item xs={12} md={7}>
          <Card variant="outlined" sx={{ height: '100%' }}>
            <CardContent>
              <Typography variant="subtitle1" fontWeight={600} gutterBottom>
                Score distribution
              </Typography>
              <Stack spacing={1.5}>
                {stats.distribution.map((bucket) => {
                  const percent = stats.attempts ? (bucket.count / stats.attempts) * 100 : 0;
                  return (
                    <Box key={bucket.label}>
                      <Stack direction="row" justifyContent="space-between">
                        <Typography variant="body2">{bucket.label}%</Typography>
                        <Typography variant="body2" fontWeight={600}>
                          {bucket.count}
                        </Typography>
                      </Stack>
                      <LinearProgress
                        variant="determinate"
                        value={percent}
                        sx={{ height: 8, borderRadius: 4 }}
                      />
                    </Box>
                  );
                })}
              </Stack>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={5}>
          <Card variant="outlined" sx={{ height: '100%' }}>
            <CardContent>
              <Typography variant="subtitle1" fontWeight={600} gutterBottom>
                Summary
              </Typography>
              <Stack spacing={1}>
                <Row label="Average correct per attempt" value={`${stats.averageCorrect} questions`} />
                <Row
                  label="Average time on task"
                  value={formatSeconds(stats.averageTimeSeconds)}
                />
                <Row label="Students who attempted" value={String(stats.students)} />
                <Row label="Total attempts" value={String(stats.attempts)} />
              </Stack>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <Card variant="outlined">
        <CardContent sx={{ overflowX: 'auto' }}>
          <Typography variant="subtitle1" fontWeight={600} gutterBottom>
            Attempt results
          </Typography>
          {items.length === 0 ? (
            <Typography variant="body2" color="text.secondary">
              No submitted attempts yet.
            </Typography>
          ) : (
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Student</TableCell>
                  <TableCell align="right">Score</TableCell>
                  <TableCell align="right">%</TableCell>
                  <TableCell align="right">Correct</TableCell>
                  <TableCell align="right">Time</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Submitted</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {items.map((attempt) => (
                  <TableRow key={attempt.id} hover>
                    <TableCell>
                      {attempt.student.firstName} {attempt.student.lastName}
                      <Typography variant="caption" color="text.secondary" display="block">
                        {attempt.student.admissionNumber}
                        {attempt.student.currentClass
                          ? ` • ${attempt.student.currentClass.name}`
                          : ''}
                      </Typography>
                    </TableCell>
                    <TableCell align="right">
                      {attempt.score}/{attempt.totalMarks}
                    </TableCell>
                    <TableCell align="right">
                      <Chip size="small" color={scoreColor(attempt.percentage)} label={`${attempt.percentage}%`} />
                    </TableCell>
                    <TableCell align="right">
                      <Typography variant="caption" color="text.secondary">
                        {attempt.correctCount}✓ {attempt.incorrectCount}✗ {attempt.unansweredCount}–
                      </Typography>
                    </TableCell>
                    <TableCell align="right">{formatSeconds(attempt.timeUsedSeconds)}</TableCell>
                    <TableCell>
                      <Chip
                        size="small"
                        label={attempt.status === 'EXPIRED' ? 'Timed out' : 'Submitted'}
                        color={attempt.status === 'EXPIRED' ? 'warning' : 'success'}
                        variant="outlined"
                      />
                    </TableCell>
                    <TableCell>{formatDate(attempt.submittedAt)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
          <Stack direction="row" justifyContent="flex-end" alignItems="center" spacing={2} sx={{ mt: 2 }}>
            <Typography variant="caption" color="text.secondary">
              Page {data.page} of {totalPages} ({data.total} total)
            </Typography>
            <Button size="small" disabled={page <= 1} onClick={() => setPage((value) => value - 1)}>
              Previous
            </Button>
            <Button size="small" disabled={page >= totalPages} onClick={() => setPage((value) => value + 1)}>
              Next
            </Button>
          </Stack>
        </CardContent>
      </Card>
    </Box>
  );
}

function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <Card variant="outlined" sx={{ height: '100%' }}>
      <CardContent sx={{ textAlign: 'center', py: 2 }}>
        <Typography variant="h6" fontWeight={700}>
          {value}
        </Typography>
        <Typography variant="caption" color="text.secondary">
          {label}
        </Typography>
      </CardContent>
    </Card>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <Stack direction="row" justifyContent="space-between">
      <Typography variant="body2" color="text.secondary">
        {label}
      </Typography>
      <Typography variant="body2" fontWeight={600}>
        {value}
      </Typography>
    </Stack>
  );
}
