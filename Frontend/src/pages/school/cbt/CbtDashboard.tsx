import { useMemo, type ReactElement, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Alert,
  Box,
  Button,
  Card,
  CardActionArea,
  CardContent,
  Chip,
  CircularProgress,
  Divider,
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
import { useNavigate } from 'react-router-dom';
import QuizIcon from '@mui/icons-material/Quiz';
import PlayCircleOutlineIcon from '@mui/icons-material/PlayCircleOutline';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import EmojiEventsIcon from '@mui/icons-material/EmojiEvents';
import InsightsIcon from '@mui/icons-material/Insights';
import MenuBookIcon from '@mui/icons-material/MenuBook';
import AssignmentIcon from '@mui/icons-material/Assignment';
import ScienceIcon from '@mui/icons-material/Science';
import HistoryIcon from '@mui/icons-material/History';
import BarChartIcon from '@mui/icons-material/BarChart';
import { useCan } from '../../../components/PermissionGate';
import {
  cbtApi,
  CBT_CATEGORY_LABELS,
  CBT_CATEGORY_ORDER,
  CBT_PLATFORM_NOTICE,
  type CbtCategory,
  type CbtStaffDashboard,
  type CbtStudentDashboard,
} from '../../../api/cbt';
import { apiErrorMessage } from '../../../api/client';
import {
  CATEGORY_ACCENTS,
  CATEGORY_COLORS,
  CATEGORY_TAGLINES,
  formatDate,
  scoreColor,
} from './cbtUi';

const CATEGORY_ICONS: Record<CbtCategory, ReactElement> = {
  WAEC: <AssignmentIcon />,
  NECO: <ScienceIcon />,
  JAMB: <MenuBookIcon />,
  MOCK: <EmojiEventsIcon />,
};

function KpiCard({
  label,
  value,
  hint,
  icon,
}: {
  label: string;
  value: string | number;
  hint?: string;
  icon: ReactNode;
}) {
  return (
    <Card variant="outlined" sx={{ height: '100%' }}>
      <CardContent>
        <Stack direction="row" spacing={1.5} alignItems="center">
          <Box sx={{ color: 'primary.main', display: 'flex' }}>{icon}</Box>
          <Box>
            <Typography variant="h5" fontWeight={700}>
              {value}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {label}
            </Typography>
            {hint && (
              <Typography variant="caption" color="text.secondary">
                {hint}
              </Typography>
            )}
          </Box>
        </Stack>
      </CardContent>
    </Card>
  );
}

export function CbtDashboardPage() {
  const navigate = useNavigate();
  const canViewQuestions = useCan('cbt.question_view');
  const canViewExams = useCan('cbt.exam_view');

  const { data, isLoading, error } = useQuery({
    queryKey: ['cbt', 'dashboard'],
    queryFn: () => cbtApi.dashboard(),
  });

  const student = data?.role === 'student' ? (data as CbtStudentDashboard) : null;
  const staff = data?.role === 'staff' ? (data as CbtStaffDashboard) : null;

  const categoryCards = useMemo(
    () =>
      CBT_CATEGORY_ORDER.map((category) => ({
        category,
        label: CBT_CATEGORY_LABELS[category],
        tagline: CATEGORY_TAGLINES[category],
        icon: CATEGORY_ICONS[category],
        color: CATEGORY_COLORS[category],
        accent: CATEGORY_ACCENTS[category],
      })),
    [],
  );

  const categorySection = (
    <>
      <Typography variant="subtitle2" color="text.secondary" sx={{ mt: 3, mb: 1 }}>
        {student ? 'Practise by category' : 'Question bank by category'}
      </Typography>
      <Grid container spacing={2}>
        {categoryCards.map(({ category, label, tagline, icon, color, accent }) => (
          <Grid item xs={12} sm={6} md={3} key={category}>
            <Card
              variant="outlined"
              sx={{
                height: '100%',
                borderTop: `4px solid ${accent}`,
                transition: 'box-shadow .2s, transform .2s',
                '&:hover': { boxShadow: 4, transform: 'translateY(-2px)' },
              }}
            >
              <CardActionArea
                sx={{ height: '100%', p: 0.5 }}
                onClick={() =>
                  student
                    ? navigate(`/school/cbt/practice?category=${category}`)
                    : navigate(`/school/cbt/questions?category=${category}`)
                }
              >
                <CardContent>
                  <Box
                    sx={{
                      width: 48,
                      height: 48,
                      borderRadius: 2,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      bgcolor: `${accent}1a`,
                      color: accent,
                      mb: 1.5,
                    }}
                  >
                    {icon}
                  </Box>
                  <Typography variant="subtitle1" fontWeight={700}>
                    {label}
                  </Typography>
                  <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 0.5 }}>
                    {tagline}
                  </Typography>
                  <Chip
                    size="small"
                    color={color as any}
                    variant="outlined"
                    label={student ? 'Practise now' : 'View questions'}
                    sx={{ mt: 1.5 }}
                  />
                </CardContent>
              </CardActionArea>
            </Card>
          </Grid>
        ))}
      </Grid>
    </>
  );

  if (isLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return <Alert severity="error">{apiErrorMessage(error)}</Alert>;
  }

  return (
    <Box>
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        justifyContent="space-between"
        alignItems={{ xs: 'flex-start', sm: 'center' }}
        spacing={2}
        sx={{ mb: 2 }}
      >
        <Box>
          <Typography variant="h5" fontWeight={700}>
            Computer-Based Tests
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {student
              ? `${student.student.name} • ${student.student.className ?? 'No class yet'}`
              : 'Question bank, practice and mock examinations for your school'}
          </Typography>
        </Box>
        <Stack direction="row" spacing={1}>
          {staff && canViewQuestions && (
            <Button variant="outlined" onClick={() => navigate('/school/cbt/questions')}>
              Question bank
            </Button>
          )}
          {staff && canViewExams && (
            <Button variant="contained" onClick={() => navigate('/school/cbt/exams')}>
              Examinations
            </Button>
          )}
          {student && (
            <Button variant="outlined" onClick={() => navigate('/school/cbt/history')}>
              My history
            </Button>
          )}
          {staff && (
            <Button variant="outlined" onClick={() => navigate('/school/cbt/performance')}>
              Performance
            </Button>
          )}
        </Stack>
      </Stack>

      <Alert severity="info" sx={{ mb: 2 }}>
        {CBT_PLATFORM_NOTICE}
      </Alert>

      {student && categorySection}

      {student ? (
        <StudentDashboard data={student} />
      ) : staff ? (
        <StaffDashboard data={staff} />
      ) : null}

      {staff && categorySection}
    </Box>
  );
}

function StudentDashboard({ data }: { data: CbtStudentDashboard }) {
  const navigate = useNavigate();

  return (
    <Box>
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={6} md={3}>
          <KpiCard
            label="Open exams"
            value={data.examinations.open}
            hint={`${data.examinations.available} assigned`}
            icon={<QuizIcon />}
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <KpiCard
            label="Completed"
            value={data.summary.completedExams}
            hint={`${data.summary.attemptedExams} attempts`}
            icon={<CheckCircleOutlineIcon />}
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <KpiCard
            label="Average score"
            value={`${data.summary.averageScore}%`}
            hint={`Pass rate ${data.summary.passRate}%`}
            icon={<InsightsIcon />}
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <KpiCard
            label="Best score"
            value={`${data.summary.bestScore}%`}
            icon={<EmojiEventsIcon />}
          />
        </Grid>
      </Grid>

      <Grid container spacing={2}>
        <Grid item xs={12} lg={7}>
          <Card variant="outlined" sx={{ height: '100%' }}>
            <CardContent>
              <Typography variant="subtitle1" fontWeight={600} gutterBottom>
                Available examinations
              </Typography>
              {data.examinations.list.length === 0 ? (
                <Typography variant="body2" color="text.secondary" sx={{ py: 3, textAlign: 'center' }}>
                  No examinations are open for you right now. Check back later or try a practice
                  category.
                </Typography>
              ) : (
                <Stack divider={<Divider flexItem />} spacing={1}>
                  {data.examinations.list.map((exam) => (
                    <Stack
                      key={exam.id}
                      direction={{ xs: 'column', sm: 'row' }}
                      justifyContent="space-between"
                      alignItems={{ xs: 'flex-start', sm: 'center' }}
                      spacing={1}
                      sx={{ py: 1 }}
                    >
                      <Box>
                        <Stack direction="row" spacing={1} alignItems="center">
                          <Typography fontWeight={600}>{exam.title}</Typography>
                          <Chip
                            size="small"
                            label={CBT_CATEGORY_LABELS[exam.category]}
                            color={CATEGORY_COLORS[exam.category] as any}
                            variant="outlined"
                          />
                        </Stack>
                        <Typography variant="caption" color="text.secondary">
                          {exam.subject?.name ?? 'General'} • {exam.questionCount} questions •{' '}
                          {exam.durationMinutes} min • {exam.totalMarks} marks
                          {exam.mode === 'PRACTICE' ? ' • Practice' : ' • Mock'}
                        </Typography>
                      </Box>
                      <Button
                        size="small"
                        variant={exam.canStart ? 'contained' : 'outlined'}
                        startIcon={<PlayCircleOutlineIcon />}
                        disabled={!exam.canStart}
                        onClick={() => navigate(`/school/cbt/exams/${exam.id}/brief`)}
                      >
                        {exam.openAttemptId
                          ? 'Resume'
                          : exam.attemptsLeft > 0
                          ? 'Start'
                          : 'Used up'}
                      </Button>
                    </Stack>
                  ))}
                </Stack>
              )}
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} lg={5}>
          <Card variant="outlined" sx={{ height: '100%' }}>
            <CardContent>
              <Typography variant="subtitle1" fontWeight={600} gutterBottom>
                Recent attempts
              </Typography>
              {data.recentAttempts.length === 0 ? (
                <Typography variant="body2" color="text.secondary" sx={{ py: 3, textAlign: 'center' }}>
                  You have not taken any examination yet.
                </Typography>
              ) : (
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Exam</TableCell>
                      <TableCell align="right">Score</TableCell>
                      <TableCell align="right">Date</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {data.recentAttempts.map((attempt) => (
                      <TableRow
                        key={attempt.id}
                        hover
                        sx={{ cursor: 'pointer' }}
                        onClick={() => navigate(`/school/cbt/attempts/${attempt.id}`)}
                      >
                        <TableCell>{attempt.exam.title}</TableCell>
                        <TableCell align="right">
                          <Chip
                            size="small"
                            color={scoreColor(attempt.percentage)}
                            label={`${attempt.percentage}%`}
                          />
                        </TableCell>
                        <TableCell align="right">{formatDate(attempt.submittedAt)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <Grid container spacing={2} sx={{ mt: 0 }}>
        <Grid item xs={12} md={6}>
          <Card variant="outlined" sx={{ height: '100%' }}>
            <CardContent>
              <Typography variant="subtitle1" fontWeight={600} gutterBottom>
                Performance by subject
              </Typography>
              {data.bySubject.length === 0 ? (
                <Typography variant="body2" color="text.secondary">
                  Not enough data yet.
                </Typography>
              ) : (
                <Stack spacing={1.5}>
                  {data.bySubject.map((row) => (
                    <Box key={row.key}>
                      <Stack direction="row" justifyContent="space-between">
                        <Typography variant="body2">{row.key}</Typography>
                        <Typography variant="body2" fontWeight={600}>
                          {row.average}%
                        </Typography>
                      </Stack>
                      <LinearProgress
                        variant="determinate"
                        value={Math.min(100, row.average)}
                        color={scoreColor(row.average)}
                        sx={{ height: 6, borderRadius: 3 }}
                      />
                    </Box>
                  ))}
                </Stack>
              )}
              {data.weakTopics.length > 0 && (
                <>
                  <Typography variant="subtitle2" sx={{ mt: 2 }} gutterBottom>
                    Focus on these topics
                  </Typography>
                  <Stack direction="row" gap={0.5} flexWrap="wrap">
                    {data.weakTopics.map((topic) => (
                      <Chip
                        key={`${topic.subject}-${topic.topic}`}
                        size="small"
                        color="warning"
                        variant="outlined"
                        label={`${topic.topic} (${topic.accuracy}%)`}
                      />
                    ))}
                  </Stack>
                </>
              )}
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={6}>
          <Card variant="outlined" sx={{ height: '100%' }}>
            <CardContent>
              <Typography variant="subtitle1" fontWeight={600} gutterBottom>
                Performance trend
              </Typography>
              {data.performanceHistory.length === 0 ? (
                <Typography variant="body2" color="text.secondary">
                  Your trend appears after your first submitted exam.
                </Typography>
              ) : (
                <Stack divider={<Divider flexItem />}>
                  {data.performanceHistory.map((point) => (
                    <Stack
                      key={point.id}
                      direction="row"
                      justifyContent="space-between"
                      alignItems="center"
                      sx={{ py: 0.75 }}
                    >
                      <Box>
                        <Typography variant="body2">{point.title}</Typography>
                        <Typography variant="caption" color="text.secondary">
                          {point.subject ?? 'General'} • {formatDate(point.submittedAt)}
                        </Typography>
                      </Box>
                      <Chip
                        size="small"
                        color={scoreColor(point.percentage)}
                        label={`${point.percentage}%`}
                      />
                    </Stack>
                  ))}
                </Stack>
              )}
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
}

function StaffDashboard({ data }: { data: CbtStaffDashboard }) {
  return (
    <Box>
      <Grid container spacing={2} sx={{ mb: 2 }}>
        <Grid item xs={12} sm={6} md={3}>
          <KpiCard
            label="Questions"
            value={data.questions.total}
            hint={`${data.questions.active} active · ${data.questions.draft} draft`}
            icon={<QuizIcon />}
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <KpiCard
            label="Examinations"
            value={data.exams.total}
            hint={`${data.exams.published} published`}
            icon={<AssignmentIcon />}
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <KpiCard
            label="Attempts"
            value={data.attempts.total}
            hint={`Avg ${data.attempts.averagePercentage}%`}
            icon={<HistoryIcon />}
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <KpiCard
            label="Pass rate"
            value={`${data.attempts.passRate}%`}
            hint={`Best ${data.attempts.bestPercentage}%`}
            icon={<BarChartIcon />}
          />
        </Grid>
      </Grid>

      {data.scoped && (
        <Alert severity="info" sx={{ mb: 2 }}>
          You are seeing results for the subjects you teach, the classes you lead and the
          examinations you created.
        </Alert>
      )}

      <Card variant="outlined">
        <CardContent>
          <Typography variant="subtitle1" fontWeight={600} gutterBottom>
            Recent submissions
          </Typography>
          {data.recentAttempts.length === 0 ? (
            <Typography variant="body2" color="text.secondary" sx={{ py: 3, textAlign: 'center' }}>
              No attempts recorded yet.
            </Typography>
          ) : (
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Student</TableCell>
                  <TableCell>Examination</TableCell>
                  <TableCell align="right">Score</TableCell>
                  <TableCell align="right">Submitted</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {data.recentAttempts.map((attempt) => (
                  <TableRow key={attempt.id}>
                    <TableCell>
                      {attempt.student.firstName} {attempt.student.lastName}
                      <Typography variant="caption" color="text.secondary" display="block">
                        {attempt.student.admissionNumber}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      {attempt.exam.title}
                      <Typography variant="caption" color="text.secondary" display="block">
                        {attempt.exam.subject?.name ?? 'General'}
                      </Typography>
                    </TableCell>
                    <TableCell align="right">
                      <Chip
                        size="small"
                        color={scoreColor(attempt.percentage)}
                        label={`${attempt.percentage}%`}
                      />
                    </TableCell>
                    <TableCell align="right">{formatDate(attempt.submittedAt)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 2 }}>
        Question bank: {data.questions.byDifficulty.EASY} easy ·{' '}
        {data.questions.byDifficulty.MEDIUM} medium · {data.questions.byDifficulty.HARD} hard.
      </Typography>
    </Box>
  );
}
