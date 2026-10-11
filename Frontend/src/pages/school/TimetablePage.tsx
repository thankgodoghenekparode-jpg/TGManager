import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  Grid,
  IconButton,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import ScheduleIcon from '@mui/icons-material/Schedule';
import RoomIcon from '@mui/icons-material/Room';
import PersonIcon from '@mui/icons-material/Person';
import { schoolApi, DAYS_OF_WEEK, type DayOfWeek, type TimetablePeriod } from '../../api/school';

interface PeriodForm {
  id?: string;
  classId: string;
  subjectId: string;
  teacherId: string;
  room: string;
  dayOfWeek: DayOfWeek;
  startTime: string;
  endTime: string;
}

const EMPTY_FORM: PeriodForm = {
  classId: '',
  subjectId: '',
  teacherId: '',
  room: '',
  dayOfWeek: 'MONDAY',
  startTime: '08:00',
  endTime: '08:45',
};

function formatTime(value: string) {
  const [h, m] = value.split(':').map(Number);
  const suffix = h >= 12 ? 'PM' : 'AM';
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  return `${hour12}:${String(m).padStart(2, '0')} ${suffix}`;
}

function teacherName(period: TimetablePeriod) {
  return period.teacher
    ? `${period.teacher.firstName} ${period.teacher.lastName}`
    : 'Unassigned';
}

export function TimetablePage() {
  const qc = useQueryClient();
  const [selectedClassId, setSelectedClassId] = useState<string>('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState<PeriodForm>(EMPTY_FORM);
  const [error, setError] = useState<string | null>(null);

  const { data: classes } = useQuery({
    queryKey: ['school', 'classes'],
    queryFn: () => schoolApi.listClasses(),
  });
  const { data: subjects } = useQuery({
    queryKey: ['school', 'subjects'],
    queryFn: () => schoolApi.listSubjects(),
  });
  const { data: staff } = useQuery({
    queryKey: ['school', 'staff'],
    queryFn: () => schoolApi.listSchoolStaff({ category: 'TEACHER' }),
  });

  const classId = selectedClassId || classes?.[0]?.id || '';

  const { data: periods } = useQuery({
    queryKey: ['school', 'timetable', classId],
    queryFn: () => schoolApi.listTimetable({ classId: classId || undefined }),
    enabled: Boolean(classId),
  });

  const grouped = useMemo(() => {
    const map = new Map<DayOfWeek, TimetablePeriod[]>();
    for (const day of DAYS_OF_WEEK) map.set(day, []);
    for (const p of periods ?? []) {
      map.get(p.dayOfWeek)?.push(p);
    }
    for (const list of map.values()) {
      list.sort((a, b) => a.startTime.localeCompare(b.startTime));
    }
    return map;
  }, [periods]);

  const saveMutation = useMutation({
    mutationFn: () => {
      const payload = {
        classId: form.classId || classId,
        subjectId: form.subjectId,
        teacherId: form.teacherId || null,
        room: form.room || null,
        dayOfWeek: form.dayOfWeek,
        startTime: form.startTime,
        endTime: form.endTime,
      };
      return form.id
        ? schoolApi.updateTimetablePeriod(form.id, payload)
        : schoolApi.createTimetablePeriod(payload);
    },
    onSuccess: () => {
      setDialogOpen(false);
      setError(null);
      qc.invalidateQueries({ queryKey: ['school', 'timetable'] });
    },
    onError: (e: any) =>
      setError(e?.response?.data?.message ?? e?.message ?? 'Failed to save period'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => schoolApi.deleteTimetablePeriod(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['school', 'timetable'] }),
  });

  const openCreate = (day: DayOfWeek) => {
    setForm({
      ...EMPTY_FORM,
      classId,
      subjectId: subjects?.[0]?.id ?? '',
      dayOfWeek: day,
    });
    setError(null);
    setDialogOpen(true);
  };

  const openEdit = (period: TimetablePeriod) => {
    setForm({
      id: period.id,
      classId: period.classId,
      subjectId: period.subjectId,
      teacherId: period.teacherId ?? '',
      room: period.room ?? '',
      dayOfWeek: period.dayOfWeek,
      startTime: period.startTime,
      endTime: period.endTime,
    });
    setError(null);
    setDialogOpen(true);
  };

  return (
    <Box sx={{ p: { xs: 2, md: 3 }, display: 'flex', flexDirection: 'column', gap: 3 }}>
      <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ xs: 'flex-start', sm: 'center' }} spacing={2}>
        <Box>
          <Typography variant="h5" fontWeight={700}>
            Class Timetable
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Weekly period schedule by class, with clash detection for classes and teachers
          </Typography>
        </Box>
        <Stack direction="row" spacing={2} alignItems="center">
          <TextField
            select
            size="small"
            label="Classroom"
            value={classId}
            onChange={(e) => setSelectedClassId(e.target.value)}
            sx={{ minWidth: 200 }}
          >
            {(classes || []).map((cls) => (
              <MenuItem key={cls.id} value={cls.id}>
                {cls.name} ({cls.level})
              </MenuItem>
            ))}
          </TextField>
          <Button variant="contained" startIcon={<AddIcon />} disabled={!classId} onClick={() => openCreate('MONDAY')} sx={{ textTransform: 'none' }}>
            Add Period
          </Button>
        </Stack>
      </Stack>

      <Grid container spacing={2}>
        {DAYS_OF_WEEK.map((day) => (
          <Grid item xs={12} sm={6} md={4} lg={2} key={day}>
            <Card sx={{ height: '100%' }}>
              <CardContent sx={{ p: 1.5, '&:last-child': { pb: 1.5 } }}>
                <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
                  <Typography variant="subtitle2" fontWeight={700}>
                    {day.charAt(0) + day.slice(1).toLowerCase()}
                  </Typography>
                  <IconButton size="small" onClick={() => openCreate(day)} disabled={!classId}>
                    <AddIcon fontSize="small" />
                  </IconButton>
                </Stack>
                <Divider sx={{ mb: 1 }} />
                <Stack spacing={1}>
                  {(grouped.get(day) ?? []).map((period) => (
                    <Card
                      key={period.id}
                      variant="outlined"
                      sx={{ p: 1, bgcolor: 'action.hover', position: 'relative' }}
                    >
                      <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
                        <Box sx={{ minWidth: 0 }}>
                          <Typography variant="body2" fontWeight={700} noWrap>
                            {period.subject.name}
                          </Typography>
                          <Stack direction="row" spacing={0.5} alignItems="center" sx={{ color: 'text.secondary' }}>
                            <ScheduleIcon sx={{ fontSize: 13 }} />
                            <Typography variant="caption">
                              {formatTime(period.startTime)} – {formatTime(period.endTime)}
                            </Typography>
                          </Stack>
                          <Stack direction="row" spacing={0.5} alignItems="center" sx={{ color: 'text.secondary' }}>
                            <PersonIcon sx={{ fontSize: 13 }} />
                            <Typography variant="caption" noWrap>
                              {teacherName(period)}
                            </Typography>
                          </Stack>
                          {period.room && (
                            <Stack direction="row" spacing={0.5} alignItems="center" sx={{ color: 'text.secondary' }}>
                              <RoomIcon sx={{ fontSize: 13 }} />
                              <Typography variant="caption">{period.room}</Typography>
                            </Stack>
                          )}
                        </Box>
                        <Stack direction="column">
                          <IconButton size="small" onClick={() => openEdit(period)}>
                            <EditIcon sx={{ fontSize: 15 }} />
                          </IconButton>
                          <IconButton size="small" color="error" onClick={() => deleteMutation.mutate(period.id)}>
                            <DeleteIcon sx={{ fontSize: 15 }} />
                          </IconButton>
                        </Stack>
                      </Stack>
                    </Card>
                  ))}
                  {(grouped.get(day) ?? []).length === 0 && (
                    <Typography variant="caption" color="text.disabled" align="center" sx={{ py: 1 }}>
                      No periods
                    </Typography>
                  )}
                </Stack>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{form.id ? 'Edit Period' : 'Add Timetable Period'}</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2} sx={{ mt: 1 }}>
            {error && <Alert severity="error">{error}</Alert>}
            <TextField
              select
              label="Classroom"
              value={form.classId || classId}
              onChange={(e) => setForm({ ...form, classId: e.target.value })}
            >
              {(classes || []).map((cls) => (
                <MenuItem key={cls.id} value={cls.id}>
                  {cls.name} ({cls.level})
                </MenuItem>
              ))}
            </TextField>
            <TextField
              select
              label="Subject"
              value={form.subjectId}
              onChange={(e) => setForm({ ...form, subjectId: e.target.value })}
            >
              {(subjects || []).map((s) => (
                <MenuItem key={s.id} value={s.id}>
                  {s.name} ({s.code})
                </MenuItem>
              ))}
            </TextField>
            <TextField
              select
              label="Teacher (optional)"
              value={form.teacherId}
              onChange={(e) => setForm({ ...form, teacherId: e.target.value })}
            >
              <MenuItem value="">Unassigned</MenuItem>
              {(staff || []).map((t) => (
                <MenuItem key={t.id} value={t.id}>
                  {t.firstName} {t.lastName}
                  {t.designation ? ` — ${t.designation}` : ''}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              label="Room (optional)"
              value={form.room}
              onChange={(e) => setForm({ ...form, room: e.target.value })}
            />
            <TextField
              select
              label="Day"
              value={form.dayOfWeek}
              onChange={(e) => setForm({ ...form, dayOfWeek: e.target.value as DayOfWeek })}
            >
              {DAYS_OF_WEEK.map((d) => (
                <MenuItem key={d} value={d}>
                  {d.charAt(0) + d.slice(1).toLowerCase()}
                </MenuItem>
              ))}
            </TextField>
            <Stack direction="row" spacing={2}>
              <TextField
                label="Start time"
                type="time"
                value={form.startTime}
                onChange={(e) => setForm({ ...form, startTime: e.target.value })}
                InputLabelProps={{ shrink: true }}
                fullWidth
              />
              <TextField
                label="End time"
                type="time"
                value={form.endTime}
                onChange={(e) => setForm({ ...form, endTime: e.target.value })}
                InputLabelProps={{ shrink: true }}
                fullWidth
              />
            </Stack>
          </Stack>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setDialogOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            disabled={saveMutation.isPending || !form.subjectId}
            onClick={() => saveMutation.mutate()}
          >
            {saveMutation.isPending ? 'Saving…' : 'Save Period'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
