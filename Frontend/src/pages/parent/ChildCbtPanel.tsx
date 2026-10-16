import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Alert,
  Box,
  Button,
  Card,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material';
import { parentApi, type ChildCbtResult } from '../../api/parent';
import { apiErrorMessage } from '../../api/client';

function formatDate(value?: string | null) {
  if (!value) return '—';
  return new Date(value).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function seconds(value: number) {
  const total = Math.max(0, Math.floor(value));
  const minutes = Math.floor(total / 60);
  return `${minutes}m ${total % 60}s`;
}

/** Parent-facing CBT results for one child (only released results are returned). */
export function ChildCbtPanel({ childId }: { childId: string }) {
  const [openAttemptId, setOpenAttemptId] = useState<string | null>(null);

  const { data, isLoading, error } = useQuery({
    queryKey: ['parent', 'cbt', childId],
    queryFn: () => parentApi.cbtAttempts(childId),
    enabled: Boolean(childId),
  });

  const { data: result, isLoading: resultLoading, error: resultError } = useQuery({
    queryKey: ['parent', 'cbt-attempt', childId, openAttemptId],
    queryFn: () => parentApi.cbtAttempt(childId, openAttemptId as string),
    enabled: Boolean(childId && openAttemptId),
  });

  if (isLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return <Alert severity="error">{apiErrorMessage(error)}</Alert>;
  }

  const items = data?.items ?? [];

  if (items.length === 0) {
    return (
      <Alert severity="info">
        No released CBT results for this child yet. Results appear here once the school releases
        them.
      </Alert>
    );
  }

  return (
    <>
      <Card>
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Examination</TableCell>
                <TableCell>Category</TableCell>
                <TableCell align="center">Score</TableCell>
                <TableCell align="center">Percentage</TableCell>
                <TableCell align="center">Result</TableCell>
                <TableCell align="center">Time</TableCell>
                <TableCell align="center">Submitted</TableCell>
                <TableCell align="right" />
              </TableRow>
            </TableHead>
            <TableBody>
              {items.map((attempt) => (
                <TableRow key={attempt.id} hover>
                  <TableCell>
                    <Typography variant="body2" fontWeight={700}>
                      {attempt.exam.title}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {attempt.exam.subject?.name ?? 'General'} • Attempt {attempt.attemptNumber}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Chip label={attempt.exam.category} size="small" variant="outlined" />
                  </TableCell>
                  <TableCell align="center">
                    {attempt.score}/{attempt.totalMarks}
                  </TableCell>
                  <TableCell align="center">
                    <Chip
                      label={`${attempt.percentage}%`}
                      size="small"
                      color={attempt.percentage >= 70 ? 'success' : attempt.percentage >= 50 ? 'warning' : 'error'}
                    />
                  </TableCell>
                  <TableCell align="center">
                    <Chip
                      label={attempt.passed ? 'Passed' : 'Not passed'}
                      size="small"
                      color={attempt.passed ? 'success' : 'error'}
                      variant="outlined"
                    />
                  </TableCell>
                  <TableCell align="center">{seconds(attempt.timeUsedSeconds)}</TableCell>
                  <TableCell align="center">{formatDate(attempt.submittedAt)}</TableCell>
                  <TableCell align="right">
                    <Button size="small" onClick={() => setOpenAttemptId(attempt.id)}>
                      View
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </Card>

      <Dialog
        open={Boolean(openAttemptId)}
        onClose={() => setOpenAttemptId(null)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>CBT result</DialogTitle>
        <DialogContent dividers>
          {resultLoading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
              <CircularProgress />
            </Box>
          ) : resultError ? (
            <Alert severity="error">{apiErrorMessage(resultError)}</Alert>
          ) : result ? (
            <CbtResultBody result={result} />
          ) : null}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenAttemptId(null)}>Close</Button>
        </DialogActions>
      </Dialog>
    </>
  );
}

function CbtResultBody({ result }: { result: ChildCbtResult }) {
  const { attempt, exam, canReview, review } = result;
  return (
    <Box>
      <Typography variant="h6" fontWeight={700}>
        {exam.title}
      </Typography>
      <Typography variant="caption" color="text.secondary">
        {exam.subject?.name ?? 'General'} • {exam.mode} • Pass mark {exam.passMark}%
      </Typography>

      <Stack direction="row" spacing={3} sx={{ my: 2 }} flexWrap="wrap" useFlexGap>
        <Stat value={`${attempt.percentage}%`} label="Percentage" />
        <Stat value={`${attempt.score}/${attempt.totalMarks}`} label="Score" />
        <Stat value={attempt.passed ? 'Passed' : 'Not passed'} label="Result" />
        <Stat value={`${attempt.correctCount}✓`} label="Correct" />
        <Stat value={`${attempt.incorrectCount}✗`} label="Incorrect" />
        <Stat value={`${attempt.unansweredCount}–`} label="Unanswered" />
        <Stat value={seconds(attempt.timeUsedSeconds)} label="Time used" />
      </Stack>

      {canReview && review ? (
        <>
          <Divider sx={{ my: 1 }} />
          <Typography variant="subtitle2" gutterBottom>
            Answer review
          </Typography>
          <Stack spacing={2}>
            {review.map((item) => (
              <Box key={item.questionId}>
                <Typography variant="body2" fontWeight={600}>
                  Q{item.index}. {item.text}
                </Typography>
                <Stack spacing={0.25} sx={{ pl: 1, mt: 0.5 }}>
                  {item.options.map((option) => {
                    const isSelected = option.id === item.selectedOptionId;
                    const isCorrect = option.isCorrect === true;
                    return (
                      <Typography
                        key={option.id}
                        variant="caption"
                        sx={{
                          color: isCorrect
                            ? 'success.main'
                            : isSelected
                              ? 'error.main'
                              : 'text.secondary',
                          fontWeight: isCorrect || isSelected ? 700 : 400,
                        }}
                      >
                        {isCorrect ? '✓ ' : isSelected ? '✗ ' : '• '}
                        {option.label}. {option.text}
                        {isSelected ? ' (child’s answer)' : ''}
                      </Typography>
                    );
                  })}
                </Stack>
                {item.explanation && (
                  <Alert severity="info" icon={false} sx={{ mt: 0.5 }}>
                    <Typography variant="caption">{item.explanation}</Typography>
                  </Alert>
                )}
              </Box>
            ))}
          </Stack>
        </>
      ) : (
        <Alert severity="info">
          Detailed answers are not shown for this examination. Only the overall score is available.
        </Alert>
      )}
    </Box>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <Box>
      <Typography variant="h6" fontWeight={700}>
        {value}
      </Typography>
      <Typography variant="caption" color="text.secondary">
        {label}
      </Typography>
    </Box>
  );
}
