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
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { useNavigate, useSearchParams } from 'react-router-dom';
import PlayCircleOutlineIcon from '@mui/icons-material/PlayCircleOutline';
import { cbtApi, CBT_CATEGORY_LABELS, CBT_CATEGORY_ORDER, type CbtCategory } from '../../../api/cbt';
import { apiErrorMessage } from '../../../api/client';
import { CATEGORY_COLORS, formatDateTime, modeLabel } from './cbtUi';

const CATEGORIES: CbtCategory[] = CBT_CATEGORY_ORDER;

export function CbtPracticePage() {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const category = (params.get('category') as CbtCategory | null) ?? 'ALL';
  const [search, setSearch] = useState('');

  const { data, isLoading, error } = useQuery({
    queryKey: ['cbt', 'available-exams'],
    queryFn: () => cbtApi.availableExams(),
  });

  const exams = (data ?? []).filter((exam) => {
    if (category !== 'ALL' && exam.category !== category) return false;
    if (search && !exam.title.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  return (
    <Box>
      <Typography variant="h5" fontWeight={700} gutterBottom>
        {category === 'ALL' ? 'Practice & examinations' : CBT_CATEGORY_LABELS[category] ?? 'Practice & examinations'}
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Only examinations assigned to you (or open to the whole school) appear here.
      </Typography>

      <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap sx={{ mb: 2 }}>
        <Chip
          label="All"
          color={category === 'ALL' ? 'primary' : 'default'}
          onClick={() => setParams({})}
        />
        {CATEGORIES.map((item) => (
          <Chip
            key={item}
            label={CBT_CATEGORY_LABELS[item]}
            color={category === item ? (CATEGORY_COLORS[item] as any) : 'default'}
            variant={category === item ? 'filled' : 'outlined'}
            onClick={() => setParams({ category: item })}
          />
        ))}
      </Stack>

      <TextField
        size="small"
        placeholder="Search by title"
        value={search}
        onChange={(event) => setSearch(event.target.value)}
        sx={{ mb: 2, maxWidth: 320, width: '100%' }}
      />

      {isLoading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
          <CircularProgress />
        </Box>
      ) : error ? (
        <Alert severity="error">{apiErrorMessage(error)}</Alert>
      ) : exams.length === 0 ? (
        <Alert severity="info">
          No examinations match this filter yet. Try another category or check back later.
        </Alert>
      ) : (
        <Grid container spacing={2}>
          {exams.map((exam) => (
            <Grid item xs={12} md={6} lg={4} key={exam.id}>
              <Card variant="outlined" sx={{ height: '100%' }}>
                <CardContent>
                  <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
                    <Typography fontWeight={600}>{exam.title}</Typography>
                    <Chip
                      size="small"
                      label={CBT_CATEGORY_LABELS[exam.category]}
                      color={CATEGORY_COLORS[exam.category] as any}
                      variant="outlined"
                    />
                  </Stack>
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                    {exam.subject?.name ?? 'General'} • {modeLabel(exam.mode)}
                  </Typography>
                  <Stack direction="row" spacing={2} sx={{ mt: 1, mb: 1 }}>
                    <Typography variant="caption">{exam.questionCount} questions</Typography>
                    <Typography variant="caption">{exam.durationMinutes} min</Typography>
                    <Typography variant="caption">{exam.totalMarks} marks</Typography>
                  </Stack>
                  <Typography variant="caption" color="text.secondary" display="block">
                    {exam.startAt || exam.endAt
                      ? `Window: ${formatDateTime(exam.startAt)} → ${formatDateTime(exam.endAt)}`
                      : 'Always open'}
                  </Typography>
                  <Stack direction="row" spacing={1} sx={{ mt: 1 }} flexWrap="wrap" useFlexGap>
                    <Chip
                      size="small"
                      variant="outlined"
                      label={`${exam.attemptsLeft} attempt${exam.attemptsLeft === 1 ? '' : 's'} left`}
                    />
                    {exam.bestPercentage > 0 && (
                      <Chip size="small" color="success" label={`Best ${exam.bestPercentage}%`} />
                    )}
                    {exam.isClosed && (
                      <Chip size="small" color="default" label="Currently closed" />
                    )}
                  </Stack>
                  <Button
                    fullWidth
                    sx={{ mt: 2 }}
                    variant={exam.canStart ? 'contained' : 'outlined'}
                    startIcon={<PlayCircleOutlineIcon />}
                    disabled={!exam.canStart}
                    onClick={() => navigate(`/school/cbt/exams/${exam.id}/brief`)}
                  >
                    {exam.openAttemptId ? 'Resume attempt' : 'View & start'}
                  </Button>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      )}
    </Box>
  );
}
