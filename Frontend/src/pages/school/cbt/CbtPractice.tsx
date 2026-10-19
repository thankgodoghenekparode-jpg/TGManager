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
import { CATEGORY_ACCENTS, CATEGORY_COLORS, formatDateTime, modeLabel } from './cbtUi';

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
          variant={category === 'ALL' ? 'filled' : 'outlined'}
          onClick={() => setParams({})}
        />
        {CATEGORIES.map((item) => {
          const active = category === item;
          return (
            <Chip
              key={item}
              label={CBT_CATEGORY_LABELS[item]}
              onClick={() => setParams({ category: item })}
              variant={active ? 'filled' : 'outlined'}
              sx={
                active
                  ? {
                      bgcolor: CATEGORY_ACCENTS[item],
                      color: '#fff',
                      '&:hover': { bgcolor: CATEGORY_ACCENTS[item] },
                    }
                  : {
                      borderColor: `${CATEGORY_ACCENTS[item]}66`,
                      color: CATEGORY_ACCENTS[item],
                    }
              }
            />
          );
        })}
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
        <Card variant="outlined">
          <CardContent sx={{ textAlign: 'center', py: 5 }}>
            <Typography variant="h6" fontWeight={700} gutterBottom>
              Nothing to practise here yet
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              No examination matches this filter. Try another category, or check back once your
              school publishes one.
            </Typography>
            <Button variant="outlined" onClick={() => setParams({})}>
              Show all categories
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Grid container spacing={2}>
          {exams.map((exam) => (
            <Grid item xs={12} md={6} lg={4} key={exam.id}>
              <Card
                variant="outlined"
                sx={{
                  height: '100%',
                  display: 'flex',
                  flexDirection: 'column',
                  borderTop: `4px solid ${CATEGORY_ACCENTS[exam.category]}`,
                  transition: 'box-shadow .2s, transform .2s',
                  '&:hover': { boxShadow: 4, transform: 'translateY(-2px)' },
                }}
              >
                <CardContent sx={{ display: 'flex', flexDirection: 'column', flexGrow: 1 }}>
                  <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={1}>
                    <Typography fontWeight={700}>{exam.title}</Typography>
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
                  <Box sx={{ flexGrow: 1 }} />
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
