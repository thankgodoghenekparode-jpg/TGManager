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
  IconButton,
  InputAdornment,
  MenuItem,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
  Avatar,
  Divider,
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import PersonAddIcon from '@mui/icons-material/PersonAdd';
import { QRCodeSVG } from 'qrcode.react';
import PrintIcon from '@mui/icons-material/Print';
import CloseIcon from '@mui/icons-material/Close';
import BadgeIcon from '@mui/icons-material/Badge';
import { schoolApi, type Student } from '../../api/school';
import { useTenantStore } from '../../store/tenant';
import { tenantLogoUrl } from '../../api/client';

export function StudentsPage() {
  const qc = useQueryClient();
  const tenant = useTenantStore((s) => s.current);
  const tenantLogo = tenantLogoUrl(tenant?.id, tenant?.logoKey);

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedClassId, setSelectedClassId] = useState<string>('ALL');
  const [selectedStudentForCard, setSelectedStudentForCard] = useState<Student | null>(null);
  const [enrollOpen, setEnrollOpen] = useState(false);

  // New Student Form State
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    gender: 'MALE',
    dateOfBirth: '2012-05-15',
    currentClassId: '',
    bloodGroup: 'O+',
    genotype: 'AA',
    phone: '',
    address: 'Lagos, Nigeria',
    guardianName: '',
    guardianPhone: '',
    guardianRelationship: 'Father',
  });

  const { data: studentsResponse, isLoading } = useQuery({
    queryKey: ['school', 'students', { search: searchTerm, classId: selectedClassId }],
    queryFn: () =>
      schoolApi.listStudents({
        search: searchTerm || undefined,
        classId: selectedClassId !== 'ALL' ? selectedClassId : undefined,
        limit: 100,
      }),
  });

  const { data: classes } = useQuery({
    queryKey: ['school', 'classes'],
    queryFn: () => schoolApi.listClasses(),
  });

  const enrollMutation = useMutation({
    mutationFn: async () => {
      const student = await schoolApi.createStudent({
        firstName: formData.firstName,
        lastName: formData.lastName,
        gender: formData.gender,
        dateOfBirth: formData.dateOfBirth,
        currentClassId: formData.currentClassId || undefined,
        bloodGroup: formData.bloodGroup,
        genotype: formData.genotype,
        phone: formData.phone,
        address: formData.address,
      });

      if (formData.guardianName && formData.guardianPhone) {
        const [gFirst, ...gRest] = formData.guardianName.split(' ');
        const guardian = await schoolApi.createGuardian({
          firstName: gFirst,
          lastName: gRest.join(' ') || 'Guardian',
          phone: formData.guardianPhone,
          relationship: formData.guardianRelationship,
        });
        await schoolApi.linkGuardian(student.id, {
          guardianId: guardian.id,
          relationship: formData.guardianRelationship,
          isPrimary: true,
        });
      }

      await schoolApi.issueIdCard(student.id);
      return student;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['school', 'students'] });
      setEnrollOpen(false);
      setFormData({
        firstName: '',
        lastName: '',
        gender: 'MALE',
        dateOfBirth: '2012-05-15',
        currentClassId: '',
        bloodGroup: 'O+',
        genotype: 'AA',
        phone: '',
        address: 'Lagos, Nigeria',
        guardianName: '',
        guardianPhone: '',
        guardianRelationship: 'Father',
      });
    },
  });

  const students = studentsResponse?.items ?? [];

  return (
    <Box sx={{ p: { xs: 2, md: 3 }, display: 'flex', flexDirection: 'column', gap: 3 }}>
      {/* Title & Actions */}
      <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ xs: 'flex-start', sm: 'center' }} spacing={2}>
        <Box>
          <Typography variant="h5" fontWeight={700}>
            Students & ID Cards
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Student roster, guardian linkages, and printable digital ID cards
          </Typography>
        </Box>
        <Button
          variant="contained"
          startIcon={<PersonAddIcon />}
          onClick={() => setEnrollOpen(true)}
          sx={{ textTransform: 'none', fontWeight: 600 }}
        >
          Enroll New Student
        </Button>
      </Stack>

      {/* Filters */}
      <Card>
        <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
          <Grid container spacing={2} alignItems="center">
            <Grid item xs={12} sm={6} md={4}>
              <TextField
                fullWidth
                size="small"
                placeholder="Search by student name or admission no..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchIcon fontSize="small" />
                    </InputAdornment>
                  ),
                }}
              />
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <TextField
                select
                fullWidth
                size="small"
                label="Classroom"
                value={selectedClassId}
                onChange={(e) => setSelectedClassId(e.target.value)}
              >
                <MenuItem value="ALL">All Classrooms</MenuItem>
                {(classes || []).map((cls) => (
                  <MenuItem key={cls.id} value={cls.id}>
                    {cls.name} ({cls.level})
                  </MenuItem>
                ))}
              </TextField>
            </Grid>
            <Grid item xs={12} md={5} sx={{ display: 'flex', justifyContent: 'flex-end' }}>
              <Typography variant="body2" color="text.secondary">
                Showing <strong>{students.length}</strong> student{students.length === 1 ? '' : 's'}
              </Typography>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* Students Table */}
      <Card>
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Admission No</TableCell>
                <TableCell>Student Full Name</TableCell>
                <TableCell>Class</TableCell>
                <TableCell>Gender</TableCell>
                <TableCell>Primary Guardian</TableCell>
                <TableCell>Medical</TableCell>
                <TableCell align="right">Digital ID Card</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {students.map((student) => {
                const primaryGuardian = student.guardians?.[0]?.guardian;
                return (
                  <TableRow key={student.id} hover>
                    <TableCell>
                      <Typography variant="body2" fontWeight={700} sx={{ fontFamily: 'monospace' }}>
                        {student.admissionNumber}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Stack direction="row" alignItems="center" spacing={1.5}>
                        <Avatar sx={{ bgcolor: 'primary.light', color: 'primary.contrastText', width: 36, height: 36, fontSize: 14 }}>
                          {student.firstName[0]}
                          {student.lastName[0]}
                        </Avatar>
                        <Box>
                          <Typography variant="body2" fontWeight={600}>
                            {student.firstName} {student.lastName}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {student.phone || 'No direct phone'}
                          </Typography>
                        </Box>
                      </Stack>
                    </TableCell>
                    <TableCell>
                      <Chip label={student.currentClass?.name ?? 'Assigned'} size="small" variant="outlined" />
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">{student.gender}</Typography>
                    </TableCell>
                    <TableCell>
                      {primaryGuardian ? (
                        <Box>
                          <Typography variant="body2" fontWeight={500}>
                            {primaryGuardian.firstName} {primaryGuardian.lastName}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {primaryGuardian.phone}
                          </Typography>
                        </Box>
                      ) : (
                        <Typography variant="caption" color="text.secondary">
                          None linked
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell>
                      <Stack direction="row" spacing={0.5}>
                        {student.bloodGroup && <Chip label={student.bloodGroup} size="small" sx={{ fontSize: 11 }} />}
                        {student.genotype && <Chip label={student.genotype} size="small" sx={{ fontSize: 11 }} />}
                      </Stack>
                    </TableCell>
                    <TableCell align="right">
                      <Button
                        size="small"
                        variant="outlined"
                        startIcon={<BadgeIcon />}
                        onClick={() => setSelectedStudentForCard(student)}
                        sx={{ textTransform: 'none' }}
                      >
                        View ID Card
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
              {students.length === 0 && !isLoading && (
                <TableRow>
                  <TableCell colSpan={7} align="center" sx={{ py: 6, color: 'text.secondary' }}>
                    No students match the current filters.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Card>

      {/* Printable Digital Student ID Card Modal */}
      <Dialog
        open={Boolean(selectedStudentForCard)}
        onClose={() => setSelectedStudentForCard(null)}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant="h6" fontWeight={700}>
            Student ID Card
          </Typography>
          <IconButton onClick={() => setSelectedStudentForCard(null)} size="small">
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent dividers sx={{ display: 'flex', justifyContent: 'center', p: 3, bgcolor: '#f8fafc' }}>
          {selectedStudentForCard && (
            <Card
              sx={{
                width: 320,
                borderRadius: 3,
                boxShadow: 4,
                overflow: 'hidden',
                background: 'linear-gradient(180deg, #0284c7 0%, #0369a1 28%, #ffffff 28%, #ffffff 100%)',
                border: '1px solid #cbd5e1',
                textAlign: 'center',
                position: 'relative',
              }}
            >
              {/* Card Header */}
              <Box sx={{ pt: 2, pb: 1, px: 2, color: 'white' }}>
                {tenantLogo ? (
                  <Box
                    component="img"
                    src={tenantLogo}
                    alt={tenant?.name ?? 'School'}
                    sx={{
                      maxHeight: 32,
                      maxWidth: 130,
                      objectFit: 'contain',
                      mx: 'auto',
                      mb: 0.75,
                      display: 'block',
                      bgcolor: 'rgba(255, 255, 255, 0.95)',
                      p: 0.35,
                      borderRadius: 1,
                    }}
                  />
                ) : null}
                <Typography variant="subtitle2" fontWeight={800} sx={{ letterSpacing: 0.5, textTransform: 'uppercase' }}>
                  {tenant?.name ?? 'School Workspace'}
                </Typography>
                <Typography variant="caption" sx={{ opacity: 0.9, fontSize: 10 }}>
                  STUDENT IDENTITY CARD
                </Typography>
              </Box>

              {/* Photo & Badge */}
              <Box sx={{ display: 'flex', justifyContent: 'center', mt: 1 }}>
                <Avatar
                  sx={{
                    width: 80,
                    height: 80,
                    border: '3px solid white',
                    boxShadow: 2,
                    bgcolor: 'primary.main',
                    fontSize: 28,
                    fontWeight: 700,
                  }}
                >
                  {selectedStudentForCard.firstName[0]}
                  {selectedStudentForCard.lastName[0]}
                </Avatar>
              </Box>

              {/* Student Details */}
              <Box sx={{ px: 2.5, pt: 1.5, pb: 2 }}>
                <Typography variant="h6" fontWeight={700} color="text.primary">
                  {selectedStudentForCard.firstName} {selectedStudentForCard.lastName}
                </Typography>
                <Typography variant="body2" color="primary.main" fontWeight={700}>
                  {selectedStudentForCard.currentClass?.name ?? 'JSS 1 Gold'}
                </Typography>

                <Divider sx={{ my: 1.5 }} />

                <Grid container spacing={1} sx={{ textAlign: 'left', fontSize: 12 }}>
                  <Grid item xs={6}>
                    <Typography variant="caption" color="text.secondary">
                      Admission No:
                    </Typography>
                    <Typography variant="body2" fontWeight={700}>
                      {selectedStudentForCard.admissionNumber}
                    </Typography>
                  </Grid>
                  <Grid item xs={6}>
                    <Typography variant="caption" color="text.secondary">
                      Gender:
                    </Typography>
                    <Typography variant="body2" fontWeight={600}>
                      {selectedStudentForCard.gender}
                    </Typography>
                  </Grid>
                  <Grid item xs={6}>
                    <Typography variant="caption" color="text.secondary">
                      Blood / Genotype:
                    </Typography>
                    <Typography variant="body2" fontWeight={600}>
                      {selectedStudentForCard.bloodGroup ?? 'O+'} / {selectedStudentForCard.genotype ?? 'AA'}
                    </Typography>
                  </Grid>
                  <Grid item xs={6}>
                    <Typography variant="caption" color="text.secondary">
                      Valid Session:
                    </Typography>
                    <Typography variant="body2" fontWeight={600}>
                      2025/2026
                    </Typography>
                  </Grid>
                </Grid>

                {/* QR Code Barcode Area */}
                <Box
                  sx={{
                    mt: 2,
                    p: 1.5,
                    bgcolor: '#f1f5f9',
                    borderRadius: 2,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: 0.5,
                  }}
                >
                  <QRCodeSVG
                    value={selectedStudentForCard.qrIdentifier}
                    size={132}
                    level="M"
                    marginSize={1}
                  />
                  <Typography
                    variant="caption"
                    sx={{
                      fontFamily: 'monospace',
                      fontWeight: 600,
                      wordBreak: 'break-all',
                      textAlign: 'center',
                    }}
                  >
                    {selectedStudentForCard.qrIdentifier}
                  </Typography>
                </Box>
              </Box>
            </Card>
          )}
        </DialogContent>
        <DialogActions sx={{ p: 2, justifyContent: 'space-between' }}>
          <Button onClick={() => setSelectedStudentForCard(null)}>Close</Button>
          <Button variant="contained" startIcon={<PrintIcon />} onClick={() => window.print()}>
            Print Card
          </Button>
        </DialogActions>
      </Dialog>

      {/* Enroll New Student Dialog */}
      <Dialog open={enrollOpen} onClose={() => setEnrollOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 700 }}>Enroll New Student</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2.5} sx={{ mt: 1 }}>
            <Typography variant="subtitle2" color="primary" fontWeight={700}>
              Student Personal Information
            </Typography>
            <Grid container spacing={2}>
              <Grid item xs={6}>
                <TextField
                  fullWidth
                  size="small"
                  label="First Name"
                  required
                  value={formData.firstName}
                  onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                />
              </Grid>
              <Grid item xs={6}>
                <TextField
                  fullWidth
                  size="small"
                  label="Last Name"
                  required
                  value={formData.lastName}
                  onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                />
              </Grid>
              <Grid item xs={6}>
                <TextField
                  select
                  fullWidth
                  size="small"
                  label="Gender"
                  value={formData.gender}
                  onChange={(e) => setFormData({ ...formData, gender: e.target.value })}
                >
                  <MenuItem value="MALE">Male</MenuItem>
                  <MenuItem value="FEMALE">Female</MenuItem>
                </TextField>
              </Grid>
              <Grid item xs={6}>
                <TextField
                  fullWidth
                  type="date"
                  size="small"
                  label="Date of Birth"
                  InputLabelProps={{ shrink: true }}
                  value={formData.dateOfBirth}
                  onChange={(e) => setFormData({ ...formData, dateOfBirth: e.target.value })}
                />
              </Grid>
              <Grid item xs={6}>
                <TextField
                  select
                  fullWidth
                  size="small"
                  label="Classroom"
                  value={formData.currentClassId}
                  onChange={(e) => setFormData({ ...formData, currentClassId: e.target.value })}
                >
                  <MenuItem value="">Select Class</MenuItem>
                  {(classes || []).map((cls) => (
                    <MenuItem key={cls.id} value={cls.id}>
                      {cls.name} ({cls.level})
                    </MenuItem>
                  ))}
                </TextField>
              </Grid>
              <Grid item xs={3}>
                <TextField
                  fullWidth
                  size="small"
                  label="Blood Group"
                  value={formData.bloodGroup}
                  onChange={(e) => setFormData({ ...formData, bloodGroup: e.target.value })}
                />
              </Grid>
              <Grid item xs={3}>
                <TextField
                  fullWidth
                  size="small"
                  label="Genotype"
                  value={formData.genotype}
                  onChange={(e) => setFormData({ ...formData, genotype: e.target.value })}
                />
              </Grid>
            </Grid>

            <Typography variant="subtitle2" color="primary" fontWeight={700} sx={{ pt: 1 }}>
              Guardian / Parent Information
            </Typography>
            <Grid container spacing={2}>
              <Grid item xs={6}>
                <TextField
                  fullWidth
                  size="small"
                  label="Guardian Full Name"
                  value={formData.guardianName}
                  onChange={(e) => setFormData({ ...formData, guardianName: e.target.value })}
                />
              </Grid>
              <Grid item xs={6}>
                <TextField
                  fullWidth
                  size="small"
                  label="Guardian Phone"
                  value={formData.guardianPhone}
                  onChange={(e) => setFormData({ ...formData, guardianPhone: e.target.value })}
                />
              </Grid>
              <Grid item xs={6}>
                <TextField
                  select
                  fullWidth
                  size="small"
                  label="Relationship"
                  value={formData.guardianRelationship}
                  onChange={(e) => setFormData({ ...formData, guardianRelationship: e.target.value })}
                >
                  <MenuItem value="Father">Father</MenuItem>
                  <MenuItem value="Mother">Mother</MenuItem>
                  <MenuItem value="Guardian">Guardian</MenuItem>
                </TextField>
              </Grid>
            </Grid>
          </Stack>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setEnrollOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            disabled={!formData.firstName || !formData.lastName || enrollMutation.isPending}
            onClick={() => enrollMutation.mutate()}
          >
            {enrollMutation.isPending ? 'Enrolling...' : 'Complete Enrollment'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
