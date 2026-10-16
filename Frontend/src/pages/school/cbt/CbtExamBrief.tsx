import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Divider,
  List,
  ListItem,
  ListItemText,
  Stack,
  Typography,
} from '@mui/material';
import { useNavigate, useParams } from 'react-router-dom';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import { cbtApi, CBT_CATEGORY_LABELS, CBT_PLATFORM_NOTICE } from '../../../api/cbt';
import { apiErrorMessage } from '../../../api/client';
import { CATEGORY_COLORS, formatSeconds, modeLabel } from './cbtUi';

export function CbtExamBriefPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);

  const { data: exam, isLoading, error: loadError } = useQuery({
    queryKey: ['cbt', 'exam-brief', id],
    queryFn: () => cbtApi.examBrief(id),
    enabled: !!id,
  });

  const startMutation = useMutation({
    mutationFn: () => cbtApi.startAttempt(id),
    onSuccess: (result) => {
      if (result.mode === 'result') {
        navigate(`/school/cbt/attempts/${result.attempt.id}`, { replace: true });
      } else {
        navigate(`/school/cbt/attempts/${result.attempt.id}`);
      }
    },
    onError: (err) => setError(apiErrorMessage(err)),
  });

  if (isLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (loadError || !exam) {
    return <Alert severity="error">{apiErrorMessage(loadError) || 'Examination not found'}</Alert>;
  }

  const resumeId = exam.openAttemptId;

  return (
    <Box sx={{ maxWidth: 820, mx: 'auto' }}>
      <Button onClick={() => navigate(-1)} sx={{ mb: 1 }}>
        ← Back
      </Button>

      <Card variant="outlined">
        <CardContent>
          <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
            <Typography variant="h5" fontWeight={700}>
              {exam.title}
            </Typography>
            <Chip
              label={CBT_CATEGORY_LABELS[exam.category]}
              color={CATEGORY_COLORS[exam.category] as any}
              size="small"
            />
            <Chip label={modeLabel(exam.mode)} size="small" variant="outlined" />
          </Stack>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            {exam.subject?.name ?? 'General'}
            {exam.class ? ` • ${exam.class.name}` : ''}
          </Typography>

          {exam.description && (
            <Typography variant="body2" sx={{ mt: 2 }}>
              {exam.description}
            </Typography>
          )}

          <Divider sx={{ my: 2 }} />

          <Stack direction="row" spacing={3} flexWrap="wrap" useFlexGap>
            <Stat label="Questions" value={String(exam.questionCount)} />
            <Stat label="Duration" value={`${exam.durationMinutes} min`} />
            <Stat label="Total marks" value={String(exam.totalMarks)} />
            <Stat label="Pass mark" value={`${exam.passMark}%`} />
            <Stat
              label="Attempts"
              value={`${exam.attemptsLeft} of ${exam.maxAttempts} left`}
            />
            {exam.negativeMarking && (
              <Stat label="Negative marking" value={`-${exam.negativeMarkPerWrong}`} />
            )}
          </Stack>

          {exam.instructions && (
            <>
              <Typography variant="subtitle2" sx={{ mt: 3 }}>
                Instructions
              </Typography>
              <Typography variant="body2" sx={{ whiteSpace: 'pre-line' }}>
                {exam.instructions}
              </Typography>
            </>
          )}

          <Typography variant="subtitle2" sx={{ mt: 3 }}>
            Before you begin
          </Typography>
          <List dense>
            <ListItem>
              <ListItemText primary="The timer is controlled by the server and starts as soon as you begin. When it reaches zero the exam submits automatically." />
            </ListItem>
            <ListItem>
              <ListItemText primary="Your answers are saved to the server as you go. You can refresh or switch devices and pick up where you left off." />
            </ListItem>
            <ListItem>
              <ListItemText primary="Use Mark for review to flag a question and return to it later from the question palette." />
            </ListItem>
            {exam.mode === 'MOCK' && (
              <ListItem>
                <ListItemText primary="This is a mock examination: correct answers are hidden until your school releases them." />
              </ListItem>
            )}
            <ListItem>
              <ListItemText
                primary={`You have ${formatSeconds(exam.durationMinutes * 60)} on the clock.`}
              />
            </ListItem>
          </List>

          <Alert severity="info" sx={{ mt: 1 }}>
            {CBT_PLATFORM_NOTICE}
          </Alert>

          {error && (
            <Alert severity="error" sx={{ mt: 2 }} onClose={() => setError(null)}>
              {error}
            </Alert>
          )}

          <Stack direction="row" spacing={2} sx={{ mt: 3 }}>
            <Button
              variant="contained"
              size="large"
              startIcon={<PlayArrowIcon />}
              disabled={!exam.canStart || startMutation.isPending}
              onClick={() => startMutation.mutate()}
            >
              {resumeId ? 'Resume examination' : 'Begin examination'}
            </Button>
            {exam.isClosed && (
              <Typography variant="body2" color="error" sx={{ alignSelf: 'center' }}>
                This examination window is currently closed.
              </Typography>
            )}
          </Stack>
        </CardContent>
      </Card>
    </Box>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
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
