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
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { cbtApi, CBT_CATEGORY_LABELS, type CbtExamMode } from '../../../api/cbt';
import { apiErrorMessage } from '../../../api/client';
import { CATEGORY_COLORS, formatDate, formatSeconds, modeLabel, scoreColor } from './cbtUi';

type ModeFilter = 'ALL' | CbtExamMode;

export function CbtHistoryPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<ModeFilter>('ALL');

  const { data, isLoading, error } = useQuery({
    queryKey: ['cbt', 'my-attempts'],
    queryFn: () => cbtApi.myAttempts({ limit: 100 }),
  });

  const items = (data?.items ?? []).filter((item) => mode === 'ALL' || item.exam.mode === mode);

  const average = items.length
    ? Math.round((items.reduce((sum, item) => sum + item.percentage, 0) / items.length) * 100) / 100
    : 0;
  const best = items.reduce((max, item) => Math.max(max, item.percentage), 0);

  return (
    <Box>
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        justifyContent="space-between"
        alignItems={{ xs: 'flex-start', sm: 'center' }}
        spacing={1}
        sx={{ mb: 2 }}
      >
        <Box>
          <Typography variant="h5" fontWeight={700}>
            My CBT history
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {items.length} completed attempt{items.length === 1 ? '' : 's'} • Average {average}% •
            Best {best}%
          </Typography>
        </Box>
        <Stack direction="row" spacing={1}>
          {(['ALL', 'PRACTICE', 'MOCK'] as ModeFilter[]).map((option) => (
            <Chip
              key={option}
              label={option === 'ALL' ? 'All' : modeLabel(option)}
              color={mode === option ? 'primary' : 'default'}
              variant={mode === option ? 'filled' : 'outlined'}
              onClick={() => setMode(option)}
            />
          ))}
        </Stack>
      </Stack>

      {isLoading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
          <CircularProgress />
        </Box>
      ) : error ? (
        <Alert severity="error">{apiErrorMessage(error)}</Alert>
      ) : items.length === 0 ? (
        <Alert severity="info">
          You have not completed any examination yet. Head to the dashboard to find one to take.
        </Alert>
      ) : (
        <Card variant="outlined">
          <CardContent sx={{ overflowX: 'auto' }}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Examination</TableCell>
                  <TableCell>Category</TableCell>
                  <TableCell align="right">Score</TableCell>
                  <TableCell align="right">Correct</TableCell>
                  <TableCell align="right">Time</TableCell>
                  <TableCell align="right">Submitted</TableCell>
                  <TableCell align="right" />
                </TableRow>
              </TableHead>
              <TableBody>
                {items.map((item) => (
                  <TableRow key={item.id} hover>
                    <TableCell>
                      {item.exam.title}
                      <Typography variant="caption" color="text.secondary" display="block">
                        {item.exam.subject?.name ?? 'General'} • Attempt {item.attemptNumber}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Chip
                        size="small"
                        variant="outlined"
                        color={CATEGORY_COLORS[item.exam.category] as any}
                        label={CBT_CATEGORY_LABELS[item.exam.category]}
                      />
                    </TableCell>
                    <TableCell align="right">
                      <Chip size="small" color={scoreColor(item.percentage)} label={`${item.percentage}%`} />
                      <Typography variant="caption" color="text.secondary" display="block">
                        {item.score}/{item.totalMarks}
                      </Typography>
                    </TableCell>
                    <TableCell align="right">
                      <Typography variant="caption" color="text.secondary">
                        {item.correctCount}✓ {item.incorrectCount}✗ {item.unansweredCount}–
                      </Typography>
                    </TableCell>
                    <TableCell align="right">{formatSeconds(item.timeUsedSeconds)}</TableCell>
                    <TableCell align="right">{formatDate(item.submittedAt)}</TableCell>
                    <TableCell align="right">
                      <Button
                        size="small"
                        onClick={() => navigate(`/school/cbt/attempts/${item.id}`)}
                      >
                        View
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </Box>
  );
}
