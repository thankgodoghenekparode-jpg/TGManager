import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  FormControlLabel,
  Grid,
  IconButton,
  InputLabel,
  MenuItem,
  Radio,
  Select,
  Stack,
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
import ArchiveIcon from '@mui/icons-material/Archive';
import UnarchiveIcon from '@mui/icons-material/Unarchive';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import DownloadIcon from '@mui/icons-material/Download';
import EditIcon from '@mui/icons-material/Edit';
import {
  AI_QUESTION_NOTICE,
  cbtApi,
  CBT_CATEGORY_LABELS,
  CBT_SOURCE_LABELS,
  type CbtCategory,
  type CbtDifficulty,
  type CbtQuestion,
  type CbtQuestionSource,
  type CbtQuestionStatus,
  type CbtImportResult,
} from '../../../api/cbt';
import { apiErrorMessage } from '../../../api/client';
import { useCan } from '../../../components/PermissionGate';
import { CATEGORY_COLORS, SOURCE_COLORS, formatDate } from './cbtUi';

const CATEGORIES: CbtCategory[] = ['JAMB', 'WAEC', 'NECO', 'SCHOOL', 'MOCK', 'GENERAL'];
const DIFFICULTIES: CbtDifficulty[] = ['EASY', 'MEDIUM', 'HARD'];
const SOURCES: CbtQuestionSource[] = ['SCHOOL', 'TGMANAGER', 'LICENSED', 'AI'];
const STATUSES: CbtQuestionStatus[] = ['DRAFT', 'ACTIVE', 'ARCHIVED'];
const OPTION_LABELS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];

interface OptionForm {
  text: string;
  isCorrect: boolean;
}

interface QuestionForm {
  id?: string;
  subjectId: string;
  topicName: string;
  category: CbtCategory;
  difficulty: CbtDifficulty;
  text: string;
  imageUrl: string;
  explanation: string;
  marks: string;
  source: CbtQuestionSource;
  status: CbtQuestionStatus;
  options: OptionForm[];
}

const emptyForm = (subjectId = ''): QuestionForm => ({
  subjectId,
  topicName: '',
  category: 'SCHOOL',
  difficulty: 'MEDIUM',
  text: '',
  imageUrl: '',
  explanation: '',
  marks: '1',
  source: 'SCHOOL',
  status: 'ACTIVE',
  options: [
    { text: '', isCorrect: true },
    { text: '', isCorrect: false },
    { text: '', isCorrect: false },
    { text: '', isCorrect: false },
  ],
});

export function CbtQuestionBankPage() {
  const qc = useQueryClient();
  const canManage = useCan('cbt.question_manage');
  const [page, setPage] = useState(1);
  const [subjectId, setSubjectId] = useState('');
  const [category, setCategory] = useState<CbtCategory | ''>('');
  const [difficulty, setDifficulty] = useState<CbtDifficulty | ''>('');
  const [source, setSource] = useState<CbtQuestionSource | ''>('');
  const [status, setStatus] = useState<CbtQuestionStatus | ''>('');
  const [search, setSearch] = useState('');

  const [form, setForm] = useState<QuestionForm | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ severity: 'success' | 'error'; message: string } | null>(
    null,
  );
  const [importOpen, setImportOpen] = useState(false);

  const { data: summary } = useQuery({
    queryKey: ['cbt', 'questions', 'summary'],
    queryFn: () => cbtApi.questionSummary(),
  });

  const { data, isLoading, error } = useQuery({
    queryKey: ['cbt', 'questions', { page, subjectId, category, difficulty, source, status, search }],
    queryFn: () =>
      cbtApi.listQuestions({
        page,
        limit: 25,
        subjectId: subjectId || undefined,
        category: category || undefined,
        difficulty: difficulty || undefined,
        source: source || undefined,
        status: status || undefined,
        search: search || undefined,
      }),
  });

  const subjects = summary?.subjects ?? [];
  const items = data?.items ?? [];
  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.limit)) : 1;

  const saveMutation = useMutation({
    mutationFn: async (values: QuestionForm) => {
      const payload: Record<string, unknown> = {
        subjectId: values.subjectId,
        topicName: values.topicName.trim() ? values.topicName.trim() : null,
        category: values.category,
        difficulty: values.difficulty,
        text: values.text.trim(),
        imageUrl: values.imageUrl.trim() ? values.imageUrl.trim() : null,
        explanation: values.explanation.trim() ? values.explanation.trim() : null,
        marks: Number(values.marks),
        source: values.source,
        status: values.status,
        options: values.options
          .filter((option) => option.text.trim().length > 0)
          .map((option) => ({ text: option.text.trim(), isCorrect: option.isCorrect })),
      };
      return values.id
        ? cbtApi.updateQuestion(values.id, payload)
        : cbtApi.createQuestion(payload);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['cbt', 'questions'] });
      setForm(null);
      setFormError(null);
      setFeedback({ severity: 'success', message: 'Question saved.' });
    },
    onError: (err) => setFormError(apiErrorMessage(err)),
  });

  const archiveMutation = useMutation({
    mutationFn: (id: string) => cbtApi.archiveQuestion(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['cbt', 'questions'] });
      setFeedback({ severity: 'success', message: 'Question archived.' });
    },
    onError: (err) => setFeedback({ severity: 'error', message: apiErrorMessage(err) }),
  });

  const restoreMutation = useMutation({
    mutationFn: (id: string) => cbtApi.restoreQuestion(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['cbt', 'questions'] });
      setFeedback({ severity: 'success', message: 'Question restored.' });
    },
    onError: (err) => setFeedback({ severity: 'error', message: apiErrorMessage(err) }),
  });

  const openCreate = () => {
    setFormError(null);
    setForm(emptyForm(subjects[0]?.id ?? ''));
  };

  const openEdit = (question: CbtQuestion) => {
    setFormError(null);
    setForm({
      id: question.id,
      subjectId: question.subject?.id ?? subjects[0]?.id ?? '',
      topicName: question.topicName ?? question.topic?.name ?? '',
      category: question.category,
      difficulty: question.difficulty,
      text: question.text,
      imageUrl: question.imageUrl ?? '',
      explanation: question.explanation ?? '',
      marks: String(question.marks),
      source: question.source,
      status: question.status,
      options: question.options.map((option) => ({
        text: option.text,
        isCorrect: option.isCorrect === true,
      })),
    });
  };

  const validateForm = (values: QuestionForm): string | null => {
    if (!values.subjectId) return 'Choose a subject.';
    if (values.text.trim().length < 3) return 'Question text is too short.';
    const filled = values.options.filter((option) => option.text.trim().length > 0);
    if (filled.length < 2) return 'Provide at least two answer options.';
    if (filled.filter((option) => option.isCorrect).length !== 1) {
      return 'Mark exactly one option as the correct answer.';
    }
    const marks = Number(values.marks);
    if (!Number.isFinite(marks) || marks <= 0) return 'Marks must be greater than zero.';
    return null;
  };

  const submitForm = () => {
    if (!form) return;
    const problem = validateForm(form);
    if (problem) {
      setFormError(problem);
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
            CBT question bank
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {summary
              ? `${summary.total} questions • ${summary.active} active • ${summary.draft} draft • ${summary.archived} archived`
              : 'Loading…'}
          </Typography>
        </Box>
        <Stack direction="row" spacing={1}>
          {canManage && (
            <Button startIcon={<UploadFileIcon />} variant="outlined" onClick={() => setImportOpen(true)}>
              Import CSV
            </Button>
          )}
          {canManage && (
            <Button startIcon={<AddIcon />} variant="contained" onClick={openCreate}>
              New question
            </Button>
          )}
        </Stack>
      </Stack>

      {feedback && (
        <Alert severity={feedback.severity} sx={{ mb: 2 }} onClose={() => setFeedback(null)}>
          {feedback.message}
        </Alert>
      )}

      <Card variant="outlined" sx={{ mb: 2 }}>
        <CardContent>
          <Grid container spacing={2}>
            <Grid item xs={12} sm={6} md={3}>
              <TextField
                fullWidth
                size="small"
                label="Search"
                value={search}
                onChange={(event) => {
                  setPage(1);
                  setSearch(event.target.value);
                }}
              />
            </Grid>
            <Grid item xs={6} sm={3} md={2}>
              <FormControl fullWidth size="small">
                <InputLabel>Subject</InputLabel>
                <Select
                  label="Subject"
                  value={subjectId}
                  onChange={(event) => {
                    setPage(1);
                    setSubjectId(event.target.value);
                  }}
                >
                  <MenuItem value="">All</MenuItem>
                  {subjects.map((subject) => (
                    <MenuItem key={subject.id} value={subject.id}>
                      {subject.code || subject.name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={6} sm={3} md={2}>
              <FormControl fullWidth size="small">
                <InputLabel>Category</InputLabel>
                <Select
                  label="Category"
                  value={category}
                  onChange={(event) => {
                    setPage(1);
                    setCategory(event.target.value as CbtCategory | '');
                  }}
                >
                  <MenuItem value="">All</MenuItem>
                  {CATEGORIES.map((item) => (
                    <MenuItem key={item} value={item}>
                      {CBT_CATEGORY_LABELS[item]}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={6} sm={3} md={2}>
              <FormControl fullWidth size="small">
                <InputLabel>Difficulty</InputLabel>
                <Select
                  label="Difficulty"
                  value={difficulty}
                  onChange={(event) => {
                    setPage(1);
                    setDifficulty(event.target.value as CbtDifficulty | '');
                  }}
                >
                  <MenuItem value="">All</MenuItem>
                  {DIFFICULTIES.map((item) => (
                    <MenuItem key={item} value={item}>
                      {item}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={6} sm={3} md={1.5}>
              <FormControl fullWidth size="small">
                <InputLabel>Source</InputLabel>
                <Select
                  label="Source"
                  value={source}
                  onChange={(event) => {
                    setPage(1);
                    setSource(event.target.value as CbtQuestionSource | '');
                  }}
                >
                  <MenuItem value="">All</MenuItem>
                  {SOURCES.map((item) => (
                    <MenuItem key={item} value={item}>
                      {CBT_SOURCE_LABELS[item]}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={6} sm={3} md={1.5}>
              <FormControl fullWidth size="small">
                <InputLabel>Status</InputLabel>
                <Select
                  label="Status"
                  value={status}
                  onChange={(event) => {
                    setPage(1);
                    setStatus(event.target.value as CbtQuestionStatus | '');
                  }}
                >
                  <MenuItem value="">All</MenuItem>
                  {STATUSES.map((item) => (
                    <MenuItem key={item} value={item}>
                      {item}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {isLoading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
          <CircularProgress />
        </Box>
      ) : error ? (
        <Alert severity="error">{apiErrorMessage(error)}</Alert>
      ) : items.length === 0 ? (
        <Alert severity="info">
          No questions match these filters. Create one or import a CSV to get started.
        </Alert>
      ) : (
        <Card variant="outlined">
          <CardContent sx={{ overflowX: 'auto' }}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Question</TableCell>
                  <TableCell>Subject</TableCell>
                  <TableCell>Category</TableCell>
                  <TableCell>Difficulty</TableCell>
                  <TableCell>Source</TableCell>
                  <TableCell align="right">Marks</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell align="right">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {items.map((question) => (
                  <TableRow key={question.id} hover>
                    <TableCell sx={{ maxWidth: 340 }}>
                      <Typography variant="body2" noWrap title={question.text}>
                        {question.text}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {question.options.length} options • {formatDate(question.createdAt)}
                      </Typography>
                    </TableCell>
                    <TableCell>{question.subject?.code ?? question.subject?.name ?? '—'}</TableCell>
                    <TableCell>
                      <Chip
                        size="small"
                        variant="outlined"
                        color={CATEGORY_COLORS[question.category] as any}
                        label={question.category}
                      />
                    </TableCell>
                    <TableCell>{question.difficulty}</TableCell>
                    <TableCell>
                      <Chip
                        size="small"
                        color={SOURCE_COLORS[question.source] as any}
                        label={question.source}
                      />
                    </TableCell>
                    <TableCell align="right">{question.marks}</TableCell>
                    <TableCell>
                      <Chip
                        size="small"
                        label={question.status}
                        color={
                          question.status === 'ACTIVE'
                            ? 'success'
                            : question.status === 'DRAFT'
                            ? 'default'
                            : 'warning'
                        }
                      />
                    </TableCell>
                    <TableCell align="right">
                      {canManage && (
                        <>
                          <Tooltip title="Edit">
                            <IconButton size="small" onClick={() => openEdit(question)}>
                              <EditIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                          {question.status === 'ARCHIVED' ? (
                            <Tooltip title="Restore">
                              <IconButton
                                size="small"
                                onClick={() => restoreMutation.mutate(question.id)}
                              >
                                <UnarchiveIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          ) : (
                            <Tooltip title="Archive">
                              <IconButton
                                size="small"
                                onClick={() => {
                                  if (
                                    window.confirm(
                                      'Archive this question? Past attempts keep their history.',
                                    )
                                  ) {
                                    archiveMutation.mutate(question.id);
                                  }
                                }}
                              >
                                <ArchiveIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          )}
                        </>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <Stack direction="row" justifyContent="flex-end" alignItems="center" spacing={2} sx={{ mt: 2 }}>
              <Typography variant="caption" color="text.secondary">
                Page {data?.page} of {totalPages} ({data?.total} total)
              </Typography>
              <Button size="small" disabled={page <= 1} onClick={() => setPage((value) => value - 1)}>
                Previous
              </Button>
              <Button
                size="small"
                disabled={page >= totalPages}
                onClick={() => setPage((value) => value + 1)}
              >
                Next
              </Button>
            </Stack>
          </CardContent>
        </Card>
      )}

      <QuestionDialog
        form={form}
        subjects={subjects}
        error={formError}
        saving={saveMutation.isPending}
        onChange={setForm}
        onClose={() => {
          setForm(null);
          setFormError(null);
        }}
        onSave={submitForm}
      />

      <ImportDialog
        open={importOpen}
        onClose={() => setImportOpen(false)}
        onImported={(message) => {
          qc.invalidateQueries({ queryKey: ['cbt', 'questions'] });
          setFeedback({ severity: 'success', message });
          setImportOpen(false);
        }}
      />
    </Box>
  );
}

function QuestionDialog({
  form,
  subjects,
  error,
  saving,
  onChange,
  onClose,
  onSave,
}: {
  form: QuestionForm | null;
  subjects: Array<{ id: string; code: string; name: string }>;
  error: string | null;
  saving: boolean;
  onChange: (form: QuestionForm) => void;
  onClose: () => void;
  onSave: () => void;
}) {
  if (!form) return null;

  const updateOption = (index: number, patch: Partial<OptionForm>) => {
    const options = form.options.map((option, i) => (i === index ? { ...option, ...patch } : option));
    onChange({ ...form, options });
  };

  const setCorrect = (index: number) => {
    onChange({
      ...form,
      options: form.options.map((option, i) => ({ ...option, isCorrect: i === index })),
    });
  };

  return (
    <Dialog open onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>{form.id ? 'Edit question' : 'New question'}</DialogTitle>
      <DialogContent dividers>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}
        {form.source === 'AI' && (
          <Alert severity="warning" sx={{ mb: 2 }}>
            {AI_QUESTION_NOTICE}
          </Alert>
        )}
        <Grid container spacing={2}>
          <Grid item xs={12} sm={6}>
            <FormControl fullWidth size="small">
              <InputLabel>Subject</InputLabel>
              <Select
                label="Subject"
                value={form.subjectId}
                onChange={(event) => onChange({ ...form, subjectId: event.target.value })}
              >
                {subjects.map((subject) => (
                  <MenuItem key={subject.id} value={subject.id}>
                    {subject.code || subject.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField
              fullWidth
              size="small"
              label="Topic (optional)"
              value={form.topicName}
              onChange={(event) => onChange({ ...form, topicName: event.target.value })}
            />
          </Grid>
          <Grid item xs={6} sm={4}>
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
          <Grid item xs={6} sm={4}>
            <FormControl fullWidth size="small">
              <InputLabel>Difficulty</InputLabel>
              <Select
                label="Difficulty"
                value={form.difficulty}
                onChange={(event) =>
                  onChange({ ...form, difficulty: event.target.value as CbtDifficulty })
                }
              >
                {DIFFICULTIES.map((item) => (
                  <MenuItem key={item} value={item}>
                    {item}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={6} sm={2}>
            <TextField
              fullWidth
              size="small"
              label="Marks"
              type="number"
              value={form.marks}
              onChange={(event) => onChange({ ...form, marks: event.target.value })}
            />
          </Grid>
          <Grid item xs={6} sm={2}>
            <FormControl fullWidth size="small">
              <InputLabel>Status</InputLabel>
              <Select
                label="Status"
                value={form.status}
                onChange={(event) =>
                  onChange({ ...form, status: event.target.value as CbtQuestionStatus })
                }
              >
                {STATUSES.map((item) => (
                  <MenuItem key={item} value={item}>
                    {item}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12}>
            <TextField
              fullWidth
              multiline
              minRows={2}
              label="Question text"
              value={form.text}
              onChange={(event) => onChange({ ...form, text: event.target.value })}
            />
          </Grid>
          <Grid item xs={12}>
            <Typography variant="subtitle2" gutterBottom>
              Answer options (select the correct one)
            </Typography>
            <Stack spacing={1}>
              {form.options.map((option, index) => (
                <Stack key={index} direction="row" spacing={1} alignItems="center">
                  <FormControlLabel
                    control={
                      <Radio
                        checked={option.isCorrect}
                        onChange={() => setCorrect(index)}
                        size="small"
                      />
                    }
                    label={OPTION_LABELS[index]}
                    sx={{ m: 0, minWidth: 56 }}
                  />
                  <TextField
                    fullWidth
                    size="small"
                    placeholder={`Option ${OPTION_LABELS[index]}`}
                    value={option.text}
                    onChange={(event) => updateOption(index, { text: event.target.value })}
                  />
                  <IconButton
                    size="small"
                    disabled={form.options.length <= 2}
                    onClick={() =>
                      onChange({
                        ...form,
                        options: form.options.filter((_, i) => i !== index),
                      })
                    }
                  >
                    <DeleteIcon fontSize="small" />
                  </IconButton>
                </Stack>
              ))}
            </Stack>
            <Button
              size="small"
              sx={{ mt: 1 }}
              startIcon={<AddIcon />}
              disabled={form.options.length >= 8}
              onClick={() =>
                onChange({ ...form, options: [...form.options, { text: '', isCorrect: false }] })
              }
            >
              Add option
            </Button>
          </Grid>
          <Grid item xs={12}>
            <TextField
              fullWidth
              multiline
              minRows={2}
              label="Explanation (shown after submission when allowed)"
              value={form.explanation}
              onChange={(event) => onChange({ ...form, explanation: event.target.value })}
            />
          </Grid>
          <Grid item xs={12} sm={6}>
            <FormControl fullWidth size="small">
              <InputLabel>Source</InputLabel>
              <Select
                label="Source"
                value={form.source}
                onChange={(event) =>
                  onChange({ ...form, source: event.target.value as CbtQuestionSource })
                }
              >
                {SOURCES.map((item) => (
                  <MenuItem key={item} value={item}>
                    {CBT_SOURCE_LABELS[item]}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField
              fullWidth
              size="small"
              label="Image URL (optional)"
              value={form.imageUrl}
              onChange={(event) => onChange({ ...form, imageUrl: event.target.value })}
            />
          </Grid>
        </Grid>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" onClick={onSave} disabled={saving}>
          {saving ? 'Saving…' : 'Save question'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

function ImportDialog({
  open,
  onClose,
  onImported,
}: {
  open: boolean;
  onClose: () => void;
  onImported: (message: string) => void;
}) {
  const [csv, setCsv] = useState('');
  const [preview, setPreview] = useState<CbtImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const previewMutation = useMutation({
    mutationFn: () => cbtApi.previewImport(csv),
    onSuccess: (result) => {
      setPreview(result);
      setError(null);
    },
    onError: (err) => setError(apiErrorMessage(err)),
  });

  const commitMutation = useMutation({
    mutationFn: () => cbtApi.commitImport(csv),
    onSuccess: (result) => onImported(`Imported ${result.created} question(s).`),
    onError: (err) => setError(apiErrorMessage(err)),
  });

  const template = useMemo(
    () =>
      'subject,category,topic,difficulty,question,optionA,optionB,optionC,optionD,correct,explanation,marks,source\n' +
      'MATH,SCHOOL,Algebra,EASY,What is 2 + 2?,3,4,5,6,B,Two plus two equals four.,1,SCHOOL\n',
    [],
  );

  const downloadTemplate = () => {
    const blob = new Blob([template], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'cbt-questions-template.csv';
    link.click();
    URL.revokeObjectURL(url);
  };

  const reset = () => {
    setCsv('');
    setPreview(null);
    setError(null);
  };

  return (
    <Dialog
      open={open}
      onClose={() => {
        reset();
        onClose();
      }}
      maxWidth="md"
      fullWidth
    >
      <DialogTitle>Import questions from CSV</DialogTitle>
      <DialogContent dividers>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}
        <Stack direction="row" spacing={1} sx={{ mb: 2 }}>
          <Button size="small" startIcon={<DownloadIcon />} onClick={downloadTemplate}>
            Download template
          </Button>
        </Stack>
        <TextField
          fullWidth
          multiline
          minRows={6}
          placeholder={template}
          value={csv}
          onChange={(event) => {
            setCsv(event.target.value);
            setPreview(null);
          }}
        />
        {preview && (
          <Box sx={{ mt: 2 }}>
            <Stack direction="row" spacing={1} sx={{ mb: 1 }}>
              <Chip color="success" label={`${preview.preview.length} valid`} />
              {preview.errors.length > 0 && (
                <Chip color="error" label={`${preview.errors.length} issue(s)`} />
              )}
            </Stack>
            {preview.errors.length > 0 && (
              <Alert severity="warning" sx={{ mb: 1, maxHeight: 160, overflowY: 'auto' }}>
                <Stack spacing={0.5}>
                  {preview.errors.map((issue, index) => (
                    <Typography key={index} variant="caption">
                      Line {issue.line}
                      {issue.column ? ` (${issue.column})` : ''}: {issue.message}
                    </Typography>
                  ))}
                </Stack>
              </Alert>
            )}
            {preview.preview.length > 0 && (
              <Box sx={{ maxHeight: 220, overflowY: 'auto', border: '1px solid', borderColor: 'divider', borderRadius: 1 }}>
                {preview.preview.map((row) => (
                  <Box key={row.line} sx={{ p: 1, borderBottom: '1px solid', borderColor: 'divider' }}>
                    <Typography variant="body2">
                      {row.question}{' '}
                      <Typography component="span" variant="caption" color="text.secondary">
                        ({row.subject}, {row.category}, {row.difficulty})
                      </Typography>
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {row.options.map((option, index) => (
                        <span key={index}>
                          {index === row.correctIndex ? '✓' : ''}
                          {option}
                          {index < row.options.length - 1 ? ' | ' : ''}
                        </span>
                      ))}
                    </Typography>
                  </Box>
                ))}
              </Box>
            )}
          </Box>
        )}
      </DialogContent>
      <DialogActions>
        <Button
          onClick={() => {
            reset();
            onClose();
          }}
        >
          Cancel
        </Button>
        <Button
          variant="outlined"
          disabled={!csv.trim() || previewMutation.isPending}
          onClick={() => previewMutation.mutate()}
        >
          Validate
        </Button>
        <Button
          variant="contained"
          disabled={!preview || preview.preview.length === 0 || commitMutation.isPending}
          onClick={() => commitMutation.mutate()}
        >
          Import {preview ? preview.preview.length : 0} question(s)
        </Button>
      </DialogActions>
    </Dialog>
  );
}
