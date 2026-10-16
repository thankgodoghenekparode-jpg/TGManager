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
  FormControl,
  InputLabel,
  LinearProgress,
  MenuItem,
  Select,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { schoolApi } from '../../../api/school';
import { cbtApi } from '../../../api/cbt';
import { apiErrorMessage } from '../../../api/client';
import { formatDate, scoreColor } from './cbtUi';

export function CbtPerformancePage() {
  const navigate = useNavigate();
  const [classId, setClassId] = useState('');

  const { data: classes } = useQuery({
    queryKey: ['school', 'classes'],
    queryFn: () => schoolApi.listClasses(),
  });

  const { data, isLoading, error } = useQuery({
    queryKey: ['cbt', 'performance', { classId }],
    queryFn: () => cbtApi.performance({ classId: classId || undefined, limit: 200 }),
  });

  const students = data?.students ?? [];

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
            CBT performance
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {data
              ? `${data.totalAttempts} attempts • ${students.length} students • Average ${data.averagePercentage}%`
              : 'Per-student results across all examinations you can view.'}
          </Typography>
        </Box>
        <Button variant="outlined" onClick={() => navigate('/school/cbt')}>
          ← Dashboard
        </Button>
      </Stack>

      <Card variant="outlined" sx={{ mb: 2 }}>
        <CardContent>
          <Stack direction="row" spacing={2} alignItems="center">
            <FormControl size="small" sx={{ minWidth: 200 }}>
              <InputLabel>Filter by class</InputLabel>
              <Select
                label="Filter by class"
                value={classId}
                onChange={(event) => setClassId(event.target.value)}
              >
                <MenuItem value="">All classes</MenuItem>
                {(classes ?? []).map((item) => (
                  <MenuItem key={item.id} value={item.id}>
                    {item.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Stack>
        </CardContent>
      </Card>

      {isLoading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
          <CircularProgress />
        </Box>
      ) : error ? (
        <Alert severity="error">{apiErrorMessage(error)}</Alert>
      ) : data && !data.hasAccess ? (
        <Alert severity="info">
          You do not have access to view CBT performance yet. Ask your school administrator to grant
          the relevant permission.
        </Alert>
      ) : students.length === 0 ? (
        <Alert severity="info">No attempts recorded yet for these students.</Alert>
      ) : (
        <Card variant="outlined">
          <CardContent sx={{ overflowX: 'auto' }}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Student</TableCell>
                  <TableCell align="center">Attempts</TableCell>
                  <TableCell align="right">Average</TableCell>
                  <TableCell align="right">Best</TableCell>
                  <TableCell align="right">Pass rate</TableCell>
                  <TableCell>Strongest subject</TableCell>
                  <TableCell>Latest attempt</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {students.map((row) => (
                  <TableRow key={row.student.id} hover>
                    <TableCell>
                      {row.student.name}
                      <Typography variant="caption" color="text.secondary" display="block">
                        {row.student.admissionNumber}
                        {row.student.className ? ` • ${row.student.className}` : ''}
                      </Typography>
                    </TableCell>
                    <TableCell align="center">{row.attempts}</TableCell>
                    <TableCell align="right">
                      <Chip
                        size="small"
                        color={scoreColor(row.averagePercentage)}
                        label={`${row.averagePercentage}%`}
                      />
                    </TableCell>
                    <TableCell align="right">{row.bestPercentage}%</TableCell>
                    <TableCell align="right">{row.passRate}%</TableCell>
                    <TableCell>
                      {row.subjects.length > 0 ? (
                        <Typography variant="caption">
                          {row.subjects[0].subject} ({row.subjects[0].average}%)
                        </Typography>
                      ) : (
                        <Typography variant="caption" color="text.secondary">
                          —
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell>{formatDate(row.lastAttemptAt)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <Box sx={{ mt: 2 }}>
              <LinearProgress
                variant="determinate"
                value={Math.min(100, data?.averagePercentage ?? 0)}
                sx={{ height: 8, borderRadius: 4 }}
              />
              <Typography variant="caption" color="text.secondary">
                School average {data?.averagePercentage ?? 0}%
              </Typography>
            </Box>
          </CardContent>
        </Card>
      )}
    </Box>
  );
}
