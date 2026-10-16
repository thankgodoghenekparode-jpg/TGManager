import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
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
  DialogContentText,
  DialogTitle,
  Divider,
  Grid,
  LinearProgress,
  Paper,
  Stack,
  Typography,
} from '@mui/material';
import NavigateBeforeIcon from '@mui/icons-material/NavigateBefore';
import NavigateNextIcon from '@mui/icons-material/NavigateNext';
import BookmarkBorderIcon from '@mui/icons-material/BookmarkBorder';
import BookmarkIcon from '@mui/icons-material/Bookmark';
import SendIcon from '@mui/icons-material/Send';
import CloudDoneIcon from '@mui/icons-material/CloudDone';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import CloudOffIcon from '@mui/icons-material/CloudOff';
import { cbtApi, type CbtAttemptPayload, type CbtResultPayload } from '../../../api/cbt';
import { apiErrorMessage } from '../../../api/client';
import { formatClock } from './cbtUi';

type SaveStatus = 'idle' | 'unsaved' | 'saving' | 'saved' | 'error';

interface AnswerState {
  selectedOptionId: string | null;
  markedForReview: boolean;
}

const SAVE_DEBOUNCE_MS = 700;

export function CbtTakeExam({
  payload,
  onFinished,
}: {
  payload: CbtAttemptPayload;
  onFinished: (result: CbtResultPayload) => void;
}) {
  const { attempt, exam, questions } = payload;

  const [answers, setAnswers] = useState<Record<string, AnswerState>>(() => {
    const initial: Record<string, AnswerState> = {};
    for (const question of questions) {
      initial[question.questionId] = { selectedOptionId: null, markedForReview: false };
    }
    for (const saved of payload.answers) {
      initial[saved.questionId] = {
        selectedOptionId: saved.selectedOptionId,
        markedForReview: saved.markedForReview,
      };
    }
    return initial;
  });

  const [current, setCurrent] = useState(0);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(attempt.lastSavedAt);
  const [submitOpen, setSubmitOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [remaining, setRemaining] = useState(attempt.remainingSeconds);

  const expiresAtMs = useMemo(() => new Date(attempt.expiresAt).getTime(), [attempt.expiresAt]);

  const pendingRef = useRef(new Map<string, AnswerState>());
  const busyRef = useRef(false);
  const finishedRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const flush = useCallback(
    async (scope?: string[]) => {
      await Promise.resolve();
      if (busyRef.current || finishedRef.current) return;
      const entries = [...pendingRef.current.entries()].filter(
        ([questionId]) => !scope || scope.includes(questionId),
      );
      if (entries.length === 0) return;

      busyRef.current = true;
      setSaveStatus('saving');
      try {
        const receipt = await cbtApi.saveAnswers(
          attempt.id,
          entries.map(([questionId, value]) => ({
            questionId,
            selectedOptionId: value.selectedOptionId,
            markedForReview: value.markedForReview,
          })),
        );
        for (const [questionId] of entries) pendingRef.current.delete(questionId);
        if (!receipt.saved) {
          // The server closed the attempt (expired) or it was already submitted.
          finishedRef.current = true;
          const fresh = await cbtApi.getAttempt(attempt.id);
          if (fresh.mode === 'result') onFinished(fresh);
          return;
        }
        setSaveStatus(pendingRef.current.size > 0 ? 'unsaved' : 'saved');
        setLastSavedAt(receipt.savedAt ?? new Date().toISOString());
      } catch (err) {
        setSaveStatus('error');
        setError(apiErrorMessage(err));
      } finally {
        busyRef.current = false;
      }
    },
    [attempt.id, onFinished],
  );

  const scheduleSave = useCallback(
    (questionId: string) => {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => void flush([questionId]), SAVE_DEBOUNCE_MS);
    },
    [flush],
  );

  const updateAnswer = useCallback(
    (questionId: string, patch: Partial<AnswerState>) => {
      setAnswers((prev) => {
        const next = { ...prev[questionId], ...patch };
        pendingRef.current.set(questionId, next);
        return { ...prev, [questionId]: next };
      });
      setSaveStatus('unsaved');
      scheduleSave(questionId);
    },
    [scheduleSave],
  );

  const submit = useCallback(
    async (auto: boolean) => {
      if (finishedRef.current) return;
      if (timerRef.current) clearTimeout(timerRef.current);
      try {
        await flush();
      } catch {
        // Submission still proceeds; the server has the last persisted answers.
      }
      finishedRef.current = true;
      try {
        const result = await cbtApi.submitAttempt(attempt.id, auto);
        onFinished(result);
      } catch (err) {
        finishedRef.current = false;
        setError(apiErrorMessage(err));
      }
    },
    [attempt.id, flush, onFinished],
  );

  // Server-authoritative countdown: recomputed against the wall clock each tick.
  useEffect(() => {
    const tick = () => {
      const left = Math.max(0, Math.floor((expiresAtMs - Date.now()) / 1000));
      setRemaining(left);
      if (left <= 0 && !finishedRef.current) void submit(true);
    };
    tick();
    const handle = setInterval(tick, 1000);
    return () => clearInterval(handle);
  }, [expiresAtMs, submit]);

  // Safety net: persist anything still pending every 10 seconds.
  useEffect(() => {
    const handle = setInterval(() => {
      if (pendingRef.current.size > 0) void flush();
    }, 10_000);
    return () => clearInterval(handle);
  }, [flush]);

  // Warn before leaving with unsaved answers.
  useEffect(() => {
    const handler = (event: BeforeUnloadEvent) => {
      if (pendingRef.current.size > 0) {
        event.preventDefault();
        event.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, []);

  const answeredCount = questions.filter((q) => answers[q.questionId]?.selectedOptionId).length;
  const markedCount = questions.filter((q) => answers[q.questionId]?.markedForReview).length;
  const unansweredCount = questions.length - answeredCount;

  const question = questions[current];
  const currentAnswer = answers[question?.questionId] ?? {
    selectedOptionId: null,
    markedForReview: false,
  };
  const progress = questions.length ? (answeredCount / questions.length) * 100 : 0;

  return (
    <Box>
      {/* Sticky exam header: title + server timer */}
      <Paper
        square
        elevation={2}
        sx={{ position: 'sticky', top: 0, zIndex: 10, p: 2, mb: 2 }}
      >
        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          justifyContent="space-between"
          alignItems={{ xs: 'flex-start', sm: 'center' }}
          spacing={1}
        >
          <Box>
            <Typography fontWeight={700}>{exam.title}</Typography>
            <Typography variant="caption" color="text.secondary">
              {exam.subject?.name ?? 'General'} • Question {current + 1} of {questions.length} •{' '}
              {answeredCount} answered
            </Typography>
          </Box>
          <Stack direction="row" spacing={2} alignItems="center">
            <Box sx={{ textAlign: 'right' }}>
              <Typography variant="caption" color="text.secondary" display="block">
                Time remaining
              </Typography>
              <Typography
                variant="h5"
                fontWeight={800}
                color={remaining <= 60 ? 'error.main' : 'text.primary'}
                sx={{ fontVariantNumeric: 'tabular-nums' }}
              >
                {formatClock(remaining)}
              </Typography>
            </Box>
            <Button
              variant="contained"
              color="success"
              startIcon={<SendIcon />}
              onClick={() => setSubmitOpen(true)}
            >
              Submit
            </Button>
          </Stack>
        </Stack>
        <LinearProgress variant="determinate" value={progress} sx={{ mt: 1.5, height: 6, borderRadius: 3 }} />
      </Paper>

      {saveStatus === 'error' && error && (
        <Alert
          severity="error"
          sx={{ mb: 2 }}
          action={
            <Button color="inherit" size="small" onClick={() => void flush()}>
              Retry
            </Button>
          }
        >
          {error}
        </Alert>
      )}

      <Grid container spacing={2}>
        {/* Question area */}
        <Grid item xs={12} md={8}>
          <Card variant="outlined">
            <CardContent>
              {question.imageUrl && (
                <Box
                  component="img"
                  src={question.imageUrl}
                  alt="Question illustration"
                  sx={{ maxWidth: '100%', maxHeight: 260, mb: 2, borderRadius: 1 }}
                />
              )}
              <Stack direction="row" spacing={1} alignItems="flex-start">
                <Chip label={`Q${current + 1}`} color="primary" size="small" />
                <Typography variant="subtitle1" fontWeight={600}>
                  {question.text}
                </Typography>
              </Stack>
              <Typography variant="caption" color="text.secondary">
                {question.marks} mark{question.marks === 1 ? '' : 's'}
                {question.topicName ? ` • ${question.topicName}` : ''}
              </Typography>

              <Stack spacing={1} sx={{ mt: 2 }}>
                {question.options.map((option) => {
                  const selected = currentAnswer.selectedOptionId === option.id;
                  return (
                    <Paper
                      key={option.id}
                      variant="outlined"
                      onClick={() =>
                        updateAnswer(question.questionId, {
                          selectedOptionId: selected ? null : option.id,
                        })
                      }
                      sx={{
                        p: 1.5,
                        cursor: 'pointer',
                        borderColor: selected ? 'primary.main' : 'divider',
                        bgcolor: selected ? 'action.selected' : 'transparent',
                        '&:hover': { borderColor: 'primary.main' },
                      }}
                    >
                      <Stack direction="row" spacing={1.5} alignItems="center">
                        <Chip
                          label={option.label}
                          size="small"
                          color={selected ? 'primary' : 'default'}
                          variant={selected ? 'filled' : 'outlined'}
                        />
                        <Typography variant="body2">{option.text}</Typography>
                      </Stack>
                    </Paper>
                  );
                })}
              </Stack>

              <Stack
                direction={{ xs: 'column', sm: 'row' }}
                justifyContent="space-between"
                spacing={1}
                sx={{ mt: 3 }}
              >
                <Button
                  startIcon={<NavigateBeforeIcon />}
                  disabled={current === 0}
                  onClick={() => setCurrent((value) => Math.max(0, value - 1))}
                >
                  Previous
                </Button>
                <Stack direction="row" spacing={1}>
                  <Button
                    variant={currentAnswer.markedForReview ? 'contained' : 'outlined'}
                    color="warning"
                    startIcon={
                      currentAnswer.markedForReview ? <BookmarkIcon /> : <BookmarkBorderIcon />
                    }
                    onClick={() =>
                      updateAnswer(question.questionId, {
                        markedForReview: !currentAnswer.markedForReview,
                      })
                    }
                  >
                    {currentAnswer.markedForReview ? 'Marked' : 'Mark for review'}
                  </Button>
                  {currentAnswer.selectedOptionId && (
                    <Button
                      onClick={() =>
                        updateAnswer(question.questionId, { selectedOptionId: null })
                      }
                    >
                      Clear
                    </Button>
                  )}
                  <Button
                    variant="contained"
                    endIcon={<NavigateNextIcon />}
                    disabled={current >= questions.length - 1}
                    onClick={() => setCurrent((value) => Math.min(questions.length - 1, value + 1))}
                  >
                    Next
                  </Button>
                </Stack>
              </Stack>
            </CardContent>
          </Card>
        </Grid>

        {/* Palette + save status */}
        <Grid item xs={12} md={4}>
          <Card variant="outlined" sx={{ position: { md: 'sticky' }, top: { md: 140 } }}>
            <CardContent>
              <Stack direction="row" justifyContent="space-between" alignItems="center">
                <Typography variant="subtitle2">Question palette</Typography>
                <SaveIndicator status={saveStatus} lastSavedAt={lastSavedAt} />
              </Stack>
              <Stack direction="row" spacing={1} sx={{ mt: 1, mb: 1 }} flexWrap="wrap" useFlexGap>
                <Legend color="primary.main" label="Current" />
                <Legend color="success.main" label="Answered" />
                <Legend color="warning.main" label="Marked" />
                <Legend color="grey.400" label="Not answered" />
              </Stack>
              <Divider sx={{ mb: 1 }} />
              <Box
                sx={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(40px, 1fr))',
                  gap: 1,
                  maxHeight: 320,
                  overflowY: 'auto',
                }}
              >
                {questions.map((item, index) => {
                  const state = answers[item.questionId];
                  const isAnswered = !!state?.selectedOptionId;
                  const isMarked = !!state?.markedForReview;
                  const isCurrent = index === current;
                  return (
                    <Button
                      key={item.questionId}
                      size="small"
                      variant={isCurrent ? 'contained' : 'outlined'}
                      color={
                        isCurrent
                          ? 'primary'
                          : isMarked
                          ? 'warning'
                          : isAnswered
                          ? 'success'
                          : 'inherit'
                      }
                      onClick={() => setCurrent(index)}
                      sx={{ minWidth: 0, p: 0.5, position: 'relative' }}
                    >
                      {index + 1}
                      {isMarked && (
                        <Box
                          sx={{
                            position: 'absolute',
                            top: 2,
                            right: 2,
                            width: 6,
                            height: 6,
                            borderRadius: '50%',
                            bgcolor: 'warning.main',
                          }}
                        />
                      )}
                    </Button>
                  );
                })}
              </Box>
              <Divider sx={{ my: 2 }} />
              <Stack spacing={0.5}>
                <SummaryRow label="Answered" value={answeredCount} color="success.main" />
                <SummaryRow label="Not answered" value={unansweredCount} color="text.secondary" />
                <SummaryRow label="Marked for review" value={markedCount} color="warning.main" />
              </Stack>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <Dialog open={submitOpen} onClose={() => setSubmitOpen(false)}>
        <DialogTitle>Submit examination?</DialogTitle>
        <DialogContent>
          <DialogContentText>
            You have answered {answeredCount} of {questions.length} questions
            {unansweredCount > 0 ? ` (${unansweredCount} unanswered)` : ''} and marked{' '}
            {markedCount} for review. Once submitted, you cannot change your answers.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSubmitOpen(false)}>Keep working</Button>
          <Button
            variant="contained"
            color="success"
            onClick={() => {
              setSubmitOpen(false);
              void submit(false);
            }}
          >
            Submit now
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

function SaveIndicator({
  status,
  lastSavedAt,
}: {
  status: SaveStatus;
  lastSavedAt: string | null;
}) {
  const map: Record<SaveStatus, { icon: ReactNode; label: string; color: string }> = {
    idle: { icon: <CloudDoneIcon fontSize="small" />, label: 'Up to date', color: 'text.secondary' },
    unsaved: {
      icon: <CloudUploadIcon fontSize="small" />,
      label: 'Unsaved changes',
      color: 'warning.main',
    },
    saving: {
      icon: <CloudUploadIcon fontSize="small" />,
      label: 'Saving…',
      color: 'info.main',
    },
    saved: {
      icon: <CloudDoneIcon fontSize="small" />,
      label: lastSavedAt
        ? `Saved ${new Date(lastSavedAt).toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit',
          })}`
        : 'Saved',
      color: 'success.main',
    },
    error: { icon: <CloudOffIcon fontSize="small" />, label: 'Not saved', color: 'error.main' },
  };
  const item = map[status];
  return (
    <Stack direction="row" spacing={0.5} alignItems="center" sx={{ color: item.color }}>
      {item.icon}
      <Typography variant="caption" sx={{ color: item.color }}>
        {item.label}
      </Typography>
    </Stack>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <Stack direction="row" spacing={0.5} alignItems="center">
      <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: color }} />
      <Typography variant="caption" color="text.secondary">
        {label}
      </Typography>
    </Stack>
  );
}

function SummaryRow({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <Stack direction="row" justifyContent="space-between">
      <Typography variant="body2" color="text.secondary">
        {label}
      </Typography>
      <Typography variant="body2" fontWeight={700} sx={{ color }}>
        {value}
      </Typography>
    </Stack>
  );
}
