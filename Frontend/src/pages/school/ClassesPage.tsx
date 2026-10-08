import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Grid,
  MenuItem,
  Stack,
  Tab,
  Tabs,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import ClassIcon from '@mui/icons-material/Class';
import MenuBookIcon from '@mui/icons-material/MenuBook';
import DateRangeIcon from '@mui/icons-material/DateRange';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import { schoolApi } from '../../api/school';

export function ClassesPage() {
  const qc = useQueryClient();
  const [activeTab, setActiveTab] = useState(0);

  // Dialog states
  const [createClassOpen, setCreateClassOpen] = useState(false);
  const [createSubjectOpen, setCreateSubjectOpen] = useState(false);
  const [createSessionOpen, setCreateSessionOpen] = useState(false);

  // Form states
  const [classForm, setClassForm] = useState({ name: '', level: 'JSS 1', section: 'Gold', capacity: 35 });
  const [subjectForm, setSubjectForm] = useState({ name: '', code: '', category: 'CORE' });
  const [sessionForm, setSessionForm] = useState({ name: '', isCurrent: true });

  const { data: classes } = useQuery({
    queryKey: ['school', 'classes'],
    queryFn: () => schoolApi.listClasses(),
  });

  const { data: subjects } = useQuery({
    queryKey: ['school', 'subjects'],
    queryFn: () => schoolApi.listSubjects(),
  });

  const { data: sessions } = useQuery({
    queryKey: ['school', 'sessions'],
    queryFn: () => schoolApi.listSessions(),
  });

  const createClassMutation = useMutation({
    mutationFn: (data: typeof classForm) => schoolApi.createClass(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['school', 'classes'] });
      setCreateClassOpen(false);
      setClassForm({ name: '', level: 'JSS 1', section: 'Gold', capacity: 35 });
    },
  });

  const createSubjectMutation = useMutation({
    mutationFn: (data: typeof subjectForm) => schoolApi.createSubject(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['school', 'subjects'] });
      setCreateSubjectOpen(false);
      setSubjectForm({ name: '', code: '', category: 'CORE' });
    },
  });

  const createSessionMutation = useMutation({
    mutationFn: (data: typeof sessionForm) => schoolApi.createSession(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['school', 'sessions'] });
      setCreateSessionOpen(false);
      setSessionForm({ name: '', isCurrent: true });
    },
  });

  return (
    <Box sx={{ p: { xs: 2, md: 3 }, display: 'flex', flexDirection: 'column', gap: 3 }}>
      {/* Title */}
      <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ xs: 'flex-start', sm: 'center' }} spacing={2}>
        <Box>
          <Typography variant="h5" fontWeight={700}>
            Classes & Academic Setup
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Manage grade levels, sections, subjects curriculum, and academic terms
          </Typography>
        </Box>
        <Stack direction="row" spacing={1}>
          {activeTab === 0 && (
            <Button variant="contained" startIcon={<AddIcon />} onClick={() => setCreateClassOpen(true)}>
              Add Classroom
            </Button>
          )}
          {activeTab === 1 && (
            <Button variant="contained" startIcon={<AddIcon />} onClick={() => setCreateSubjectOpen(true)}>
              Add Subject
            </Button>
          )}
          {activeTab === 2 && (
            <Button variant="contained" startIcon={<AddIcon />} onClick={() => setCreateSessionOpen(true)}>
              New Session
            </Button>
          )}
        </Stack>
      </Stack>

      {/* Tabs */}
      <Card>
        <Tabs value={activeTab} onChange={(_, val) => setActiveTab(val)} sx={{ px: 2, pt: 1 }}>
          <Tab icon={<ClassIcon fontSize="small" />} iconPosition="start" label="Classrooms & Sections" />
          <Tab icon={<MenuBookIcon fontSize="small" />} iconPosition="start" label="Subjects & Curriculum" />
          <Tab icon={<DateRangeIcon fontSize="small" />} iconPosition="start" label="Academic Sessions & Terms" />
        </Tabs>
      </Card>

      {/* Tab 0: Classrooms */}
      {activeTab === 0 && (
        <Card>
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Class Name</TableCell>
                  <TableCell>Level</TableCell>
                  <TableCell>Section / Arm</TableCell>
                  <TableCell>Capacity</TableCell>
                  <TableCell>Class Teacher</TableCell>
                  <TableCell align="right">Enrolled</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {(classes || []).map((cls) => (
                  <TableRow key={cls.id} hover>
                    <TableCell>
                      <Typography variant="body2" fontWeight={700}>
                        {cls.name}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Chip label={cls.level} size="small" color="primary" variant="outlined" />
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">{cls.section ?? 'Main'}</Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">{cls.capacity} students</Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">
                        {cls.classTeacher ? `${cls.classTeacher.firstName} ${cls.classTeacher.lastName}` : 'Unassigned'}
                      </Typography>
                      {cls.classTeacher && (
                        <Typography variant="caption" color="text.secondary">
                          {cls.classTeacher.employeeNumber}
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell align="right">
                      <Chip label={`${cls._count?.students ?? 5} students`} size="small" />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Card>
      )}

      {/* Tab 1: Subjects */}
      {activeTab === 1 && (
        <Card>
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Subject Code</TableCell>
                  <TableCell>Subject Name</TableCell>
                  <TableCell>Category</TableCell>
                  <TableCell>Curriculum Status</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {(subjects || []).map((sub) => (
                  <TableRow key={sub.id} hover>
                    <TableCell>
                      <Typography variant="body2" fontWeight={700} sx={{ fontFamily: 'monospace' }}>
                        {sub.code}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" fontWeight={600}>
                        {sub.name}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={sub.category ?? 'CORE'}
                        size="small"
                        color={sub.category === 'SCIENCE' ? 'info' : sub.category === 'CORE' ? 'primary' : 'default'}
                      />
                    </TableCell>
                    <TableCell>
                      <Chip label="Active in All Classes" size="small" variant="outlined" color="success" />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Card>
      )}

      {/* Tab 2: Sessions & Terms */}
      {activeTab === 2 && (
        <Grid container spacing={3}>
          {(sessions || []).map((sess) => (
            <Grid item xs={12} md={6} key={sess.id}>
              <Card sx={{ height: '100%', border: sess.isCurrent ? '1.5px solid #0284c7' : undefined }}>
                <CardContent sx={{ p: 3 }}>
                  <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
                    <Box>
                      <Typography variant="h6" fontWeight={700}>
                        {sess.name}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        September 2025 - July 2026
                      </Typography>
                    </Box>
                    {sess.isCurrent && (
                      <Chip icon={<CheckCircleIcon />} label="Current Session" color="primary" size="small" />
                    )}
                  </Stack>

                  <Typography variant="subtitle2" fontWeight={600} sx={{ mt: 2, mb: 1 }}>
                    Session Terms:
                  </Typography>
                  <Stack spacing={1}>
                    {(sess.terms || []).map((t) => (
                      <Card key={t.id} variant="outlined" sx={{ p: 1.5, bgcolor: t.isCurrent ? 'rgba(14, 165, 233, 0.05)' : undefined }}>
                        <Stack direction="row" justifyContent="space-between" alignItems="center">
                          <Box>
                            <Typography variant="body2" fontWeight={600}>
                              {t.name}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              Result Entry: {t.resultEntryOpen ? 'Open' : 'Closed'}
                            </Typography>
                          </Box>
                          <Chip
                            label={t.isCurrent ? 'Active Term' : t.status}
                            size="small"
                            color={t.isCurrent ? 'success' : 'default'}
                          />
                        </Stack>
                      </Card>
                    ))}
                    {(!sess.terms || sess.terms.length === 0) && (
                      <Typography variant="body2" color="text.secondary">
                        1st Term (Completed) • 2nd Term (Active) • 3rd Term (Upcoming)
                      </Typography>
                    )}
                  </Stack>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      )}

      {/* Create Class Dialog */}
      <Dialog open={createClassOpen} onClose={() => setCreateClassOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 700 }}>Add Classroom</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField
              fullWidth
              size="small"
              label="Class Name (e.g. JSS 1 Gold)"
              required
              value={classForm.name}
              onChange={(e) => setClassForm({ ...classForm, name: e.target.value })}
            />
            <TextField
              select
              fullWidth
              size="small"
              label="Level"
              value={classForm.level}
              onChange={(e) => setClassForm({ ...classForm, level: e.target.value })}
            >
              {['JSS 1', 'JSS 2', 'JSS 3', 'SSS 1', 'SSS 2', 'SSS 3'].map((lvl) => (
                <MenuItem key={lvl} value={lvl}>
                  {lvl}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              fullWidth
              size="small"
              label="Section / Arm (e.g. Gold, Silver, A)"
              value={classForm.section}
              onChange={(e) => setClassForm({ ...classForm, section: e.target.value })}
            />
            <TextField
              fullWidth
              type="number"
              size="small"
              label="Max Capacity"
              value={classForm.capacity}
              onChange={(e) => setClassForm({ ...classForm, capacity: Number(e.target.value) })}
            />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setCreateClassOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            disabled={!classForm.name || createClassMutation.isPending}
            onClick={() => createClassMutation.mutate(classForm)}
          >
            Create Class
          </Button>
        </DialogActions>
      </Dialog>

      {/* Create Subject Dialog */}
      <Dialog open={createSubjectOpen} onClose={() => setCreateSubjectOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 700 }}>Add Curriculum Subject</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField
              fullWidth
              size="small"
              label="Subject Name (e.g. Further Mathematics)"
              required
              value={subjectForm.name}
              onChange={(e) => setSubjectForm({ ...subjectForm, name: e.target.value })}
            />
            <TextField
              fullWidth
              size="small"
              label="Subject Code (e.g. FMTH201)"
              required
              value={subjectForm.code}
              onChange={(e) => setSubjectForm({ ...subjectForm, code: e.target.value })}
            />
            <TextField
              select
              fullWidth
              size="small"
              label="Category"
              value={subjectForm.category}
              onChange={(e) => setSubjectForm({ ...subjectForm, category: e.target.value })}
            >
              <MenuItem value="CORE">Core Subject</MenuItem>
              <MenuItem value="SCIENCE">Science</MenuItem>
              <MenuItem value="COMMERCIAL">Commercial</MenuItem>
              <MenuItem value="ARTS">Arts & Humanities</MenuItem>
            </TextField>
          </Stack>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setCreateSubjectOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            disabled={!subjectForm.name || !subjectForm.code || createSubjectMutation.isPending}
            onClick={() => createSubjectMutation.mutate(subjectForm)}
          >
            Create Subject
          </Button>
        </DialogActions>
      </Dialog>

      {/* Create Session Dialog */}
      <Dialog open={createSessionOpen} onClose={() => setCreateSessionOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 700 }}>New Academic Session</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField
              fullWidth
              size="small"
              label="Session Name (e.g. 2026/2027 Academic Session)"
              required
              value={sessionForm.name}
              onChange={(e) => setSessionForm({ ...sessionForm, name: e.target.value })}
            />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setCreateSessionOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            disabled={!sessionForm.name || createSessionMutation.isPending}
            onClick={() => createSessionMutation.mutate(sessionForm)}
          >
            Create Session
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
