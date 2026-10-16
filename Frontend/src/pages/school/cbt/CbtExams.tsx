import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Alert,
  Autocomplete,
  Box,
  Button,
  Card,
  CardContent,
  Checkbox,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControl,
  FormControlLabel,
  Grid,
  IconButton,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import AssessmentIcon from '@mui/icons-material/Assessment';
import GroupAddIcon from '@mui/icons-material/GroupAdd';
import EditIcon from '@mui/icons-material/Edit';
import { useNavigate } from 'react-router-dom';
import { schoolApi } from '../../../api/school';
import {
  cbtApi,
  CBT_CATEGORY_LABELS,
  type CbtCategory,
  type CbtExamDetail,
  type CbtExamMode,
  type CbtExamStatus,
} from '../../../api/cbt';
import { apiErrorMessage } from '../../../api/client';
import { useCan } from '../../../components/PermissionGate';
import { CATEGORY_COLORS, formatDateTime, modeLabel } from './cbtUi';

const CATEGORIES: CbtCategory[] = ['JAMB', 'WAEC', 'NECO', 'SCHOOL', 'MOCK', 'GENERAL'];
const MODES: CbtExamMode[] = ['PRACTICE', 'MOCK'];
const STATUSES: CbtExamStatus[] = ['DRAFT', 'PUBLISHED', 'ARCHIVED'];

interface ExamForm {
  id?: string;
  hasAttempts?: boolean;
  title: string;
  category: CbtCategory;
  mode: CbtExamMode;
  subjectId: string;
  classId: string;
  description: string;
  instructions: string;
  durationMinutes: string;
  passMark: string;
  maxAttempts: string;
  startAt: string;
  endAt: string;
  status: CbtExamStatus;
  randomizeQuestions: boolean;
  randomizeOptions: boolean;
  showResultImmediately: boolean;
  showCorrectAnswers: boolean;
  negativeMarking: boolean;
  negativeMarkPerWrong: string;
  autoPickCount: string;
  autoPickCategory: CbtCategory | '';
  questionIds: string[];
  currentQuestionCount: number;
}

const emptyForm = (): ExamForm => ({
  title: '',
  category: 'SCHOOL',
  mode: 'MOCK',
  subjectId: '',
  classId: '',
  description: '',
  instructions: '',
  durationMinutes: '30',
  passMark: '50',
  maxAttempts: '1',
  startAt: '',
  endAt: '',
  status: 'DRAFT',
  randomizeQuestions: true,
  randomizeOptions: false,
  showResultImmediately: true,
  showCorrectAnswers: false,
  negativeMarking: false,
  negativeMarkPerWrong: '0',
  autoPickCount: '10',
  autoPickCategory: '',
  questionIds: [],
  currentQuestionCount: 0,
});

/** ISO string -> value accepted by <input type="datetime-local">. */
function toLocalInput(value?: string | null): string {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const offset = date.getTimezoneOffset();
  return new Date(date.getTime() - offset * 60_000).toISOString().slice(0, 16);
}

export function CbtExamsPage() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const canManage = useCan('cbt.exam_manage');
  const [status, setStatus] = useState<CbtExamStatus | ''>('');
  const [search, setSearch] = useState('');
  const [form, setForm] = useState<ExamForm | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [assignTarget, setAssignTarget] = useState<CbtExamDetail | null>(null);
  const [feedback, setFeedback] = useState<{ severity: 'success' | 'error'; message: string } | null>(
    null,
  );

  const { data, isLoading, error } = useQuery({
    queryKey: ['cbt', 'exams', { status, search }],
    queryFn: () =>
      cbtApi.listExams({ status: status || undefined, search: search || undefined, limit: 100 }),
  });

  const { data: classes } = useQuery({
    queryKey: ['school', 'classes'],
    queryFn: () => schoolApi.listClasses(),
  });

  const { data: students } = useQuery({
    queryKey: ['school', 'students', 'cbt'],
    queryFn: () => schoolApi.listStudents({ limit: 200 }),
  });

  const examItems = data?.items ?? [];
  const classList = useMemo(
    () => (classes ?? []).map((item) => ({ id: item.id, name: item.name })),
    [classes],
  );
  const studentList = (students?.items ?? []).map((student) => ({
    id: student.id,
    name: `${student.firstName} ${student.lastName}`.trim(),
    admissionNumber: student.admissionNumber,
  }));

  const saveMutation = useMutation({
    mutationFn: async (values: ExamForm) => {
      const base: Record<string, unknown> = {
        title: values.title.trim(),
        category: values.category,
        mode: values.mode,
        subjectId: values.subjectId || null,
        classId: values.classId || null,
        description: values.description.trim() || null,
        instructions: values.instructions.trim() || null,
        durationMinutes: Number(values.durationMinutes),
        passMark: Number(values.passMark),
        maxAttempts: Number(values.maxAttempts),
        randomizeQuestions: values.randomizeQuestions,
        randomizeOptions: values.randomizeOptions,
        showResultImmediately: values.showResultImmediately,
        showCorrectAnswers: values.showCorrectAnswers,
        negativeMarking: values.negativeMarking,
        negativeMarkPerWrong: Number(values.negativeMarkPerWrong),
        startAt: values.startAt ? new Date(values.startAt).toISOString() : null,
        endAt: values.endAt ? new Date(values.endAt).toISOString() : null,
        status: values.status,
      };

      if (values.id) {
        const payload = { ...base };
        if (values.questionIds.length > 0) payload.questionIds = values.questionIds;
        return cbtApi.updateExam(values.id, payload);
      }

      const payload = {
        ...base,
        questionIds: values.questionIds,
        autoPickCount: values.questionIds.length > 0 ? 0 : Number(values.autoPickCount),
        autoPickCategory: values.autoPickCategory || undefined,
      };
      return cbtApi.createExam(payload);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['cbt', 'exams'] });
      setForm(null);
      setFormError(null);
      setFeedback({ severity: 'success', message: 'Examination saved.' });
    },
    onError: (err) => setFormError(apiErrorMessage(err)),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => cbtApi.deleteExam(id),
    onSuccess: (result) => {
      qc.invalidateQueries({ queryKey: ['cbt', 'exams'] });
      setFeedback({
        severity: 'success',
        message:
          result.action === 'deleted'
            ? 'Examination deleted.'
            : 'Examination had attempts, so it was archived instead.',
      });
    },
    onError: (err) => setFeedback({ severity: 'error', message: apiErrorMessage(err) }),
  });

  const openCreate = () => {
    setFormError(null);
    setForm(emptyForm());
  };

  const openEdit = async (id: string) => {
    setFormError(null);
    try {
      const exam = await cbtApi.getExam(id);
      setForm({
        id: exam.id,
        hasAttempts: (exam._count?.attempts ?? 0) > 0,
        title: exam.title,
        category: exam.category,
        mode: exam.mode,
        subjectId: exam.subject?.id ?? '',
        classId: exam.class?.id ?? '',
        description: exam.description ?? '',
        instructions: exam.instructions ?? '',
        durationMinutes: String(exam.durationMinutes),
        passMark: String(exam.passMark),
        maxAttempts: String(exam.maxAttempts),
        startAt: toLocalInput(exam.startAt),
        endAt: toLocalInput(exam.endAt),
        status: exam.status,
        randomizeQuestions: exam.randomizeQuestions,
        randomizeOptions: exam.randomizeOptions,
        showResultImmediately: exam.showResultImmediately,
        showCorrectAnswers: exam.showCorrectAnswers,
        negativeMarking: exam.negativeMarking,
        negativeMarkPerWrong: String(exam.negativeMarkPerWrong),
        autoPickCount: '0',
        autoPickCategory: '',
        questionIds: [],
        currentQuestionCount: exam._count?.questions ?? exam.questions.length,
      });
    } catch (err) {
      setFeedback({ severity: 'error', message: apiErrorMessage(err) });
    }
  };

  const submitForm = () => {
    if (!form) return;
    if (form.title.trim().length < 3) {
      setFormError('Title is required.');
      return;
    }
    if (!Number(form.durationMinutes) || Number(form.durationMinutes) < 1) {
      setFormError('Duration is required.');
      return;
    }
    if (!form.id && form.questionIds.length === 0 && Number(form.autoPickCount) < 1) {
      setFormError('Select questions or choose how many to pick automatically.');
      return;
    }
    if (form.negativeMarking && Number(form.negativeMarkPerWrong) <= 0) {
      setFormError('Set the marks deducted per wrong answer.');
      return;
    }
    saveMutation.mutate(form);
  };

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
            CBT examinations
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Create practice tests and mock examinations, assign them, and review results.
          </Typography>
        </Box>
        {canManage && (
          <Button startIcon={<AddIcon />} variant="contained" onClick={openCreate}>
            New examination
          </Button>
        )}
      </Stack>

      {feedback && (
        <Alert severity={feedback.severity} sx={{ mb: 2 }} onClose={() => setFeedback(null)}>
          {feedback.message}
        </Alert>
      )}

      <Card variant="outlined" sx={{ mb: 2 }}>
        <CardContent>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            <TextField
              size="small"
              label="Search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              sx={{ maxWidth: 320 }}
            />
            <FormControl size="small" sx={{ minWidth: 160 }}>
              <InputLabel>Status</InputLabel>
              <Select
                label="Status"
                value={status}
                onChange={(event) => setStatus(event.target.value as CbtExamStatus | '')}
              >
                <MenuItem value="">All</MenuItem>
                {STATUSES.map((item) => (
                  <MenuItem key={item} value={item}>
                    {item}
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
      ) : examItems.length === 0 ? (
        <Alert severity="info">No examinations yet. Create your first one.</Alert>
      ) : (
        <Card variant="outlined">
          <CardContent sx={{ overflowX: 'auto' }}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Examination</TableCell>
                  <TableCell>Category</TableCell>
                  <TableCell>Mode</TableCell>
                  <TableCell align="center">Questions</TableCell>
                  <TableCell align="center">Duration</TableCell>
                  <TableCell align="center">Attempts</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Window</TableCell>
                  <TableCell align="right">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {examItems.map((exam) => (
                  <TableRow key={exam.id} hover>
                    <TableCell>
                      {exam.title}
                      <Typography variant="caption" color="text.secondary" display="block">
                        {exam.subject?.name ?? 'General'}
                        {exam.class ? ` • ${exam.class.name}` : ''}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Chip
                        size="small"
                        variant="outlined"
                        color={CATEGORY_COLORS[exam.category] as any}
                        label={exam.category}
                      />
                    </TableCell>
                    <TableCell>{modeLabel(exam.mode)}</TableCell>
                    <TableCell align="center">{exam._count?.questions ?? 0}</TableCell>
                    <TableCell align="center">{exam.durationMinutes}m</TableCell>
                    <TableCell align="center">{exam._count?.attempts ?? 0}</TableCell>
                    <TableCell>
                      <Chip
                        size="small"
                        label={exam.status}
                        color={
                          exam.status === 'PUBLISHED'
                            ? 'success'
                            : exam.status === 'DRAFT'
                            ? 'default'
                            : 'warning'
                        }
                      />
                    </TableCell>
                    <TableCell>
                      <Typography variant="caption" color="text.secondary">
                        {exam.startAt || exam.endAt
                          ? `${formatDateTime(exam.startAt)} → ${formatDateTime(exam.endAt)}`
                          : 'Always open'}
                      </Typography>
                    </TableCell>
                    <TableCell align="right">
                      <Tooltip title="Results">
                        <IconButton
                          size="small"
                          onClick={() => navigate(`/school/cbt/exams/${exam.id}/report`)}
                        >
                          <AssessmentIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      {canManage && (
                        <>
                          <Tooltip title="Assign">
                            <IconButton
                              size="small"
                              onClick={async () => {
                                try {
                                  setAssignTarget(await cbtApi.getExam(exam.id));
                                } catch (err) {
                                  setFeedback({
                                    severity: 'error',
                                    message: apiErrorMessage(err),
                                  });
                                }
                              }}
                            >
                              <GroupAddIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="Edit">
                            <IconButton size="small" onClick={() => void openEdit(exam.id)}>
                              <EditIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="Delete / archive">
                            <IconButton
                              size="small"
                              onClick={() => {
                                if (
                                  window.confirm(
                                    'Delete this examination? If any student has attempted it, it will be archived instead.',
                                  )
                                ) {
                                  deleteMutation.mutate(exam.id);
                                }
                              }}
                            >
                              <DeleteIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        </>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <ExamDialog
        form={form}
        classList={classList}
        subjects={examSubjects(examItems)}
        error={formError}
        saving={saveMutation.isPending}
        onChange={setForm}
        onClose={() => {
          setForm(null);
          setFormError(null);
        }}
        onSave={submitForm}
        onPickQuestions={() => setPickerOpen(true)}
      />

      <QuestionPickerDialog
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        selected={form?.questionIds ?? []}
        onConfirm={(questionIds) => {
          if (form) setForm({ ...form, questionIds, currentQuestionCount: questionIds.length });
          setPickerOpen(false);
        }}
      />

      <AssignDialog
        exam={assignTarget}
        classes={classList}
        students={studentList}
        onClose={() => setAssignTarget(null)}
        onDone={(message) => {
          qc.invalidateQueries({ queryKey: ['cbt', 'exams'] });
          setAssignTarget(null);
          setFeedback({ severity: 'success', message });
        }}
      />
    </Box>
  );
}

/** Distinct subjects seen on existing exams, used to seed the exam dialog. */
function examSubjects(
  items: Array<{ subject?: { id: string; code: string; name: string } | null }>,
) {
  const map = new Map<string, { id: string; code: string; name: string }>();
  for (const item of items) {
    if (item.subject) map.set(item.subject.id, item.subject);
  }
  return [...map.values()];
}

function ExamDialog({
  form,
  subjects,
  classList,
  error,
  saving,
  onChange,
  onClose,
  onSave,
  onPickQuestions,
}: {
  form: ExamForm | null;
  subjects: Array<{ id: string; code: string; name: string }>;
  classList: Array<{ id: string; name: string }>;
  error: string | null;
  saving: boolean;
  onChange: (form: ExamForm) => void;
  onClose: () => void;
  onSave: () => void;
  onPickQuestions: () => void;
}) {
  if (!form) return null;
  const isPractice = form.mode === 'PRACTICE';

  return (
    <Dialog open onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>{form.id ? 'Edit examination' : 'New examination'}</DialogTitle>
      <DialogContent dividers>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}
        <Grid container spacing={2}>
          <Grid item xs={12}>
            <TextField
              fullWidth
              size="small"
              label="Title"
              value={form.title}
              onChange={(event) => onChange({ ...form, title: event.target.value })}
            />
          </Grid>
          <Grid item xs={6} sm={3}>
            <FormControl fullWidth size="small">
              <InputLabel>Category</InputLabel>
              <Select
                label="Category"
                value={form.category}
                onChange={(event) => onChange({ ...form, category: event.target.value as CbtCategory })}
              >
                {CATEGORIES.map((item) => (
                  <MenuItem key={item} value={item}>
                    {CBT_CATEGORY_LABELS[item]}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={6} sm={3}>
            <FormControl fullWidth size="small">
              <InputLabel>Mode</InputLabel>
              <Select
                label="Mode"
                value={form.mode}
                onChange={(event) => {
                  const mode = event.target.value as CbtExamMode;
                  onChange({
                    ...form,
                    mode,
                    showCorrectAnswers: mode === 'PRACTICE' ? true : form.showCorrectAnswers,
                  });
                }}
              >
                {MODES.map((item) => (
                  <MenuItem key={item} value={item}>
                    {modeLabel(item)}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={6} sm={3}>
            <FormControl fullWidth size="small">
              <InputLabel>Subject</InputLabel>
              <Select
                label="Subject"
                value={form.subjectId}
                onChange={(event) => onChange({ ...form, subjectId: event.target.value })}
              >
                <MenuItem value="">General</MenuItem>
                {subjects.map((subject) => (
                  <MenuItem key={subject.id} value={subject.id}>
                    {subject.code || subject.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={6} sm={3}>
            <FormControl fullWidth size="small">
              <InputLabel>Target class</InputLabel>
              <Select
                label="Target class"
                value={form.classId}
                onChange={(event) => onChange({ ...form, classId: event.target.value })}
              >
                <MenuItem value="">No class restriction</MenuItem>
                {classList.map((item) => (
                  <MenuItem key={item.id} value={item.id}>
                    {item.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={6} sm={3}>
            <TextField
              fullWidth
              size="small"
              label="Duration (minutes)"
              type="number"
              value={form.durationMinutes}
              onChange={(event) => onChange({ ...form, durationMinutes: event.target.value })}
            />
          </Grid>
          <Grid item xs={6} sm={3}>
            <TextField
              fullWidth
              size="small"
              label="Pass mark (%)"
              type="number"
              value={form.passMark}
              onChange={(event) => onChange({ ...form, passMark: event.target.value })}
            />
          </Grid>
          <Grid item xs={6} sm={3}>
            <TextField
              fullWidth
              size="small"
              label="Max attempts"
              type="number"
              value={form.maxAttempts}
              onChange={(event) => onChange({ ...form, maxAttempts: event.target.value })}
            />
          </Grid>
          <Grid item xs={6} sm={3}>
            <FormControl fullWidth size="small">
              <InputLabel>Status</InputLabel>
              <Select
                label="Status"
                value={form.status}
                onChange={(event) => onChange({ ...form, status: event.target.value as CbtExamStatus })}
              >
                {STATUSES.map((item) => (
                  <MenuItem key={item} value={item}>
                    {item}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={6} sm={3}>
            <TextField
              fullWidth
              size="small"
              label="Starts at"
              type="datetime-local"
              InputLabelProps={{ shrink: true }}
              value={form.startAt}
              onChange={(event) => onChange({ ...form, startAt: event.target.value })}
            />
          </Grid>
          <Grid item xs={6} sm={3}>
            <TextField
              fullWidth
              size="small"
              label="Ends at"
              type="datetime-local"
              InputLabelProps={{ shrink: true }}
              value={form.endAt}
              onChange={(event) => onChange({ ...form, endAt: event.target.value })}
            />
          </Grid>

          <Grid item xs={12}>
            <TextField
              fullWidth
              multiline
              minRows={2}
              size="small"
              label="Description (optional)"
              value={form.description}
              onChange={(event) => onChange({ ...form, description: event.target.value })}
            />
          </Grid>
          <Grid item xs={12}>
            <TextField
              fullWidth
              multiline
              minRows={2}
              size="small"
              label="Instructions (optional)"
              value={form.instructions}
              onChange={(event) => onChange({ ...form, instructions: event.target.value })}
            />
          </Grid>

          <Grid item xs={12}>
            <Divider />
            <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 1 }}>
              <Typography variant="subtitle2">Behaviour</Typography>
            </Stack>
          </Grid>
          <Grid item xs={6} sm={3}>
            <FormControlLabel
              control={
                <Switch
                  checked={form.randomizeQuestions}
                  onChange={(event) => onChange({ ...form, randomizeQuestions: event.target.checked })}
                />
              }
              label="Shuffle questions"
            />
          </Grid>
          <Grid item xs={6} sm={3}>
            <FormControlLabel
              control={
                <Switch
                  checked={form.randomizeOptions}
                  onChange={(event) => onChange({ ...form, randomizeOptions: event.target.checked })}
                />
              }
              label="Shuffle options"
            />
          </Grid>
          <Grid item xs={6} sm={3}>
            <FormControlLabel
              control={
                <Switch
                  checked={form.showResultImmediately}
                  onChange={(event) =>
                    onChange({ ...form, showResultImmediately: event.target.checked })
                  }
                />
              }
              label="Show result on submit"
            />
          </Grid>
          <Grid item xs={6} sm={3}>
            <FormControlLabel
              control={
                <Switch
                  checked={form.showCorrectAnswers}
                  disabled={isPractice}
                  onChange={(event) =>
                    onChange({ ...form, showCorrectAnswers: event.target.checked })
                  }
                />
              }
              label={isPractice ? 'Answers shown (practice)' : 'Show correct answers'}
            />
          </Grid>
          <Grid item xs={6} sm={3}>
            <FormControlLabel
              control={
                <Switch
                  checked={form.negativeMarking}
                  onChange={(event) => onChange({ ...form, negativeMarking: event.target.checked })}
                />
              }
              label="Negative marking"
            />
          </Grid>
          {form.negativeMarking && (
            <Grid item xs={6} sm={3}>
              <TextField
                fullWidth
                size="small"
                label="Deduct per wrong answer"
                type="number"
                value={form.negativeMarkPerWrong}
                onChange={(event) =>
                  onChange({ ...form, negativeMarkPerWrong: event.target.value })
                }
              />
            </Grid>
          )}

          <Grid item xs={12}>
            <Divider />
            <Stack direction="row" spacing={2} alignItems="center" sx={{ mt: 1 }} flexWrap="wrap" useFlexGap>
              <Typography variant="subtitle2">Questions</Typography>
              {form.id ? (
                <>
                  <Chip
                    label={`${form.currentQuestionCount} question(s) on this exam`}
                    color="default"
                  />
                  <Button
                    size="small"
                    variant="outlined"
                    disabled={form.hasAttempts}
                    onClick={onPickQuestions}
                  >
                    Replace questions
                  </Button>
                  {form.hasAttempts && (
                    <Typography variant="caption" color="text.secondary">
                      Questions are locked because students have already attempted this exam.
                    </Typography>
                  )}
                  {form.questionIds.length > 0 && (
                    <Chip color="primary" label={`Will replace with ${form.questionIds.length}`} />
                  )}
                </>
              ) : (
                <>
                  <TextField
                    size="small"
                    label="Auto-pick count"
                    type="number"
                    value={form.autoPickCount}
                    onChange={(event) =>
                      onChange({ ...form, autoPickCount: event.target.value, questionIds: [] })
                    }
                    sx={{ width: 150 }}
                  />
                  <FormControl size="small" sx={{ minWidth: 160 }}>
                    <InputLabel>Auto-pick category</InputLabel>
                    <Select
                      label="Auto-pick category"
                      value={form.autoPickCategory}
                      onChange={(event) =>
                        onChange({
                          ...form,
                          autoPickCategory: event.target.value as CbtCategory | '',
                        })
                      }
                    >
                      <MenuItem value="">Subject default</MenuItem>
                      {CATEGORIES.map((item) => (
                        <MenuItem key={item} value={item}>
                          {CBT_CATEGORY_LABELS[item]}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                  <Button size="small" variant="outlined" onClick={onPickQuestions}>
                    Or pick manually
                  </Button>
                  {form.questionIds.length > 0 && (
                    <Chip color="primary" label={`${form.questionIds.length} selected`} />
                  )}
                </>
              )}
            </Stack>
          </Grid>
        </Grid>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" onClick={onSave} disabled={saving}>
          {saving ? 'Saving…' : 'Save examination'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

function QuestionPickerDialog({
  open,
  selected,
  onClose,
  onConfirm,
}: {
  open: boolean;
  selected: string[];
  onClose: () => void;
  onConfirm: (ids: string[]) => void;
}) {
  const [chosen, setChosen] = useState<string[]>(selected);
  const [search, setSearch] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['cbt', 'questions', 'picker', search],
    queryFn: () => cbtApi.listQuestions({ status: 'ACTIVE', search: search || undefined, limit: 100 }),
    enabled: open,
  });

  const questions = data?.items ?? [];

  const toggle = (id: string) => {
    setChosen((prev) => (prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]));
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      TransitionProps={{
        onEnter: () => setChosen(selected),
      }}
    >
      <DialogTitle>Select questions ({chosen.length} chosen)</DialogTitle>
      <DialogContent dividers>
        <TextField
          fullWidth
          size="small"
          label="Search questions"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          sx={{ mb: 2 }}
        />
        {isLoading ? (
          <CircularProgress />
        ) : questions.length === 0 ? (
          <Typography variant="body2" color="text.secondary">
            No active questions found.
          </Typography>
        ) : (
          <Box sx={{ maxHeight: 360, overflowY: 'auto' }}>
            {questions.map((question) => (
              <Stack
                key={question.id}
                direction="row"
                spacing={1}
                alignItems="flex-start"
                sx={{ py: 0.5 }}
              >
                <Checkbox
                  size="small"
                  checked={chosen.includes(question.id)}
                  onChange={() => toggle(question.id)}
                />
                <Box>
                  <Typography variant="body2">{question.text}</Typography>
                  <Typography variant="caption" color="text.secondary">
                    {question.subject?.code ?? '—'} • {question.difficulty} • {question.marks} mark(s)
                  </Typography>
                </Box>
              </Stack>
            ))}
          </Box>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" onClick={() => onConfirm(chosen)}>
          Use {chosen.length} question(s)
        </Button>
      </DialogActions>
    </Dialog>
  );
}

function AssignDialog({
  exam,
  classes,
  students,
  onClose,
  onDone,
}: {
  exam: CbtExamDetail | null;
  classes: Array<{ id: string; name: string }>;
  students: Array<{ id: string; name: string; admissionNumber: string }>;
  onClose: () => void;
  onDone: (message: string) => void;
}) {
  const [classId, setClassId] = useState('');
  const [studentIds, setStudentIds] = useState<string[]>([]);
  const [replace, setReplace] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const assignMutation = useMutation({
    mutationFn: () =>
      cbtApi.assignExam(exam!.id, {
        classId: classId || null,
        studentIds,
        replace,
      }),
    onSuccess: (result: any) => {
      const added = result?.added ?? 0;
      onDone(`Assignment saved (${added} new).`);
    },
    onError: (err) => setError(apiErrorMessage(err)),
  });

  if (!exam) return null;

  return (
    <Dialog open onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Assign “{exam.title}”</DialogTitle>
      <DialogContent dividers>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          An examination with no assignments is open to every student in the school. Adding a class
          or specific students limits it to them.
        </Typography>
        <FormControl fullWidth size="small" sx={{ mb: 2 }}>
          <InputLabel>Class</InputLabel>
          <Select label="Class" value={classId} onChange={(event) => setClassId(event.target.value)}>
            <MenuItem value="">No class</MenuItem>
            {classes.map((item) => (
              <MenuItem key={item.id} value={item.id}>
                {item.name}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
        <Autocomplete
          multiple
          options={students}
          getOptionLabel={(option) => `${option.name} (${option.admissionNumber})`}
          value={students.filter((student) => studentIds.includes(student.id))}
          onChange={(_, value) => setStudentIds(value.map((item) => item.id))}
          renderInput={(params) => <TextField {...params} size="small" label="Specific students" />}
        />
        <FormControlLabel
          sx={{ mt: 1 }}
          control={
            <Checkbox checked={replace} onChange={(event) => setReplace(event.target.checked)} />
          }
          label="Replace existing assignments"
        />
        {exam.assignments.length > 0 && (
          <Box sx={{ mt: 1 }}>
            <Typography variant="caption" color="text.secondary">
              Currently assigned: {exam.assignments.length}
            </Typography>
          </Box>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" onClick={() => assignMutation.mutate()} disabled={assignMutation.isPending}>
          Save assignment
        </Button>
      </DialogActions>
    </Dialog>
  );
}
