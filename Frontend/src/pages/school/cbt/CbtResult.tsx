import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Divider,
  Grid,
  Stack,
  Typography,
} from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CancelIcon from '@mui/icons-material/Cancel';
import RadioButtonUncheckedIcon from '@mui/icons-material/RadioButtonUnchecked';
import ReplayIcon from '@mui/icons-material/Replay';
import type { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import type { CbtResultPayload } from '../../../api/cbt';
import { CBT_CATEGORY_LABELS } from '../../../api/cbt';
import { CATEGORY_COLORS, formatDateTime, formatSeconds, modeLabel } from './cbtUi';

export function CbtResultView({ result }: { result: CbtResultPayload }) {
  const navigate = useNavigate();
  const { attempt, exam, visible, canReview, review } = result;

  return (
    <Box sx={{ maxWidth: 960, mx: 'auto' }}>
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
              label={CBT_CATEGORY_LABELS[exam.category]}
              color={CATEGORY_COLORS[exam.category] as any}
              variant="outlined"
            />
            <Typography variant="caption" color="text.secondary">
              {exam.subject?.name ?? 'General'} • {modeLabel(exam.mode)} • Attempt{' '}
              {attempt.attemptNumber}
            </Typography>
          </Stack>
        </Box>
        <Stack direction="row" spacing={1}>
          <Button variant="outlined" onClick={() => navigate('/school/cbt')}>
            Dashboard
          </Button>
          <Button variant="outlined" onClick={() => navigate('/school/cbt/history')}>
            History
          </Button>
        </Stack>
      </Stack>

      {result.autoTriggered && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          Time ran out, so your examination was submitted automatically. Your saved answers were
          used.
        </Alert>
      )}
      {result.alreadySubmitted && (
        <Alert severity="info" sx={{ mb: 2 }}>
          This examination was already submitted — showing the recorded result.
        </Alert>
      )}

      {!visible ? (
        <Card variant="outlined">
          <CardContent sx={{ textAlign: 'center', py: 5 }}>
            <CheckCircleIcon color="success" sx={{ fontSize: 48 }} />
            <Typography variant="h6" sx={{ mt: 1 }}>
              Submission received
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Your answers have been recorded. Your school has not released the results for this
              examination yet — they will appear here once released.
            </Typography>
            <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 2 }}>
              Submitted {formatDateTime(attempt.submittedAt)} • Attempt {attempt.attemptNumber}
            </Typography>
          </CardContent>
        </Card>
      ) : (
        <>
          <Grid container spacing={2} sx={{ mb: 2 }}>
            <Grid item xs={12} md={4}>
              <Card variant="outlined" sx={{ height: '100%' }}>
                <CardContent sx={{ textAlign: 'center' }}>
                  <Typography variant="h3" fontWeight={800}>
                    {attempt.percentage}%
                  </Typography>
                  <Typography variant="body2" color="text.secondary" gutterBottom>
                    {attempt.score} / {attempt.totalMarks} marks
                  </Typography>
                  <Chip
                    color={attempt.passed ? 'success' : 'error'}
                    label={attempt.passed ? 'Passed' : 'Not passed'}
                  />
                  <Typography
                    variant="caption"
                    display="block"
                    color="text.secondary"
                    sx={{ mt: 1 }}
                  >
                    Pass mark {exam.passMark}%
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} md={8}>
              <Card variant="outlined" sx={{ height: '100%' }}>
                <CardContent>
                  <Stack direction="row" spacing={3} flexWrap="wrap" useFlexGap>
                    <Metric
                      icon={<CheckCircleIcon color="success" />}
                      label="Correct"
                      value={attempt.correctCount ?? 0}
                    />
                    <Metric
                      icon={<CancelIcon color="error" />}
                      label="Incorrect"
                      value={attempt.incorrectCount ?? 0}
                    />
                    <Metric
                      icon={<RadioButtonUncheckedIcon color="disabled" />}
                      label="Unanswered"
                      value={attempt.unansweredCount ?? 0}
                    />
                    <Metric
                      icon={<ReplayIcon color="action" />}
                      label="Time used"
                      value={formatSeconds(attempt.timeUsedSeconds)}
                    />
                  </Stack>
                  <Divider sx={{ my: 2 }} />
                  <Typography variant="caption" color="text.secondary">
                    Started {formatDateTime(attempt.startedAt)} • Submitted{' '}
                    {formatDateTime(attempt.submittedAt)}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
          </Grid>

          {canReview && review ? (
            <Card variant="outlined">
              <CardContent>
                <Typography variant="subtitle1" fontWeight={600} gutterBottom>
                  Answer review
                </Typography>
                <Stack divider={<Divider flexItem />} spacing={2}>
                  {review.map((item) => (
                    <Box key={item.questionId}>
                      <Stack direction="row" spacing={1} alignItems="center">
                        <Chip
                          size="small"
                          label={`Q${item.index}`}
                          color={item.isCorrect ? 'success' : item.answered ? 'error' : 'default'}
                        />
                        <Typography variant="body2" fontWeight={600}>
                          {item.text}
                        </Typography>
                      </Stack>
                      <Stack spacing={0.5} sx={{ mt: 1, pl: 1 }}>
                        {item.options.map((option) => {
                          const isSelected = option.id === item.selectedOptionId;
                          const isCorrect = option.isCorrect === true;
                          const color = isCorrect
                            ? 'success.main'
                            : isSelected
                            ? 'error.main'
                            : 'text.secondary';
                          return (
                            <Typography
                              key={option.id}
                              variant="body2"
                              sx={{ color, fontWeight: isCorrect || isSelected ? 600 : 400 }}
                            >
                              {isCorrect ? '✓ ' : isSelected ? '✗ ' : '• '}
                              {option.label}. {option.text}
                              {isSelected ? '  (your answer)' : ''}
                            </Typography>
                          );
                        })}
                      </Stack>
                      {item.explanation && (
                        <Alert severity="info" icon={false} sx={{ mt: 1 }}>
                          <Typography variant="caption">
                            <strong>Explanation:</strong> {item.explanation}
                          </Typography>
                        </Alert>
                      )}
                      <Typography
                        variant="caption"
                        color="text.secondary"
                        sx={{ display: 'block', mt: 0.5 }}
                      >
                        {item.marksAwarded} / {item.marks} marks
                      </Typography>
                    </Box>
                  ))}
                </Stack>
              </CardContent>
            </Card>
          ) : (
            <Alert severity="info">
              Detailed answers are not shown for this examination. Only the overall score is
              available.
            </Alert>
          )}
        </>
      )}
    </Box>
  );
}

function Metric({
  icon,
  label,
  value,
}: {
  icon: ReactNode;
  label: string;
  value: string | number;
}) {
  return (
    <Stack direction="row" spacing={1} alignItems="center">
      {icon}
      <Box>
        <Typography variant="h6" fontWeight={700}>
          {value}
        </Typography>
        <Typography variant="caption" color="text.secondary">
          {label}
        </Typography>
      </Box>
    </Stack>
  );
}
