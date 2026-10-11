import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Alert,
  Box,
  Button,
  Card,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
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
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import { schoolApi, SCHOOL_STAFF_CATEGORIES, type SchoolStaffCategory, type SchoolStaffMember } from '../../api/school';

interface StaffForm {
  id?: string;
  firstName: string;
  lastName: string;
  employeeNumber: string;
  email: string;
  phone: string;
  department: string;
  designation: string;
  category: string;
  status: string;
}

const EMPTY_FORM: StaffForm = {
  firstName: '',
  lastName: '',
  employeeNumber: '',
  email: '',
  phone: '',
  department: '',
  designation: '',
  category: 'TEACHER',
  status: 'ACTIVE',
};

export function SchoolStaffPage() {
  const qc = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState<StaffForm>(EMPTY_FORM);
  const [search, setSearch] = useState('');
  const [error, setError] = useState<string | null>(null);

  const { data: staff } = useQuery({
    queryKey: ['school', 'staff', search],
    queryFn: () => schoolApi.listSchoolStaff({ search: search || undefined }),
  });

  const saveMutation = useMutation({
    mutationFn: () => {
      const payload = {
        firstName: form.firstName,
        lastName: form.lastName,
        employeeNumber: form.employeeNumber || undefined,
        email: form.email || null,
        phone: form.phone || null,
        department: form.department || null,
        designation: form.designation || null,
        category: form.category as SchoolStaffCategory,
        status: form.status,
      };
      return form.id
        ? schoolApi.updateSchoolStaff(form.id, payload)
        : schoolApi.createSchoolStaff(payload);
    },
    onSuccess: () => {
      setDialogOpen(false);
      setError(null);
      qc.invalidateQueries({ queryKey: ['school', 'staff'] });
    },
    onError: (e: any) =>
      setError(e?.response?.data?.message ?? e?.message ?? 'Failed to save staff'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => schoolApi.deleteSchoolStaff(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['school', 'staff'] }),
  });

  const openCreate = () => {
    setForm(EMPTY_FORM);
    setError(null);
    setDialogOpen(true);
  };

  const openEdit = (member: SchoolStaffMember) => {
    setForm({
      id: member.id,
      firstName: member.firstName,
      lastName: member.lastName,
      employeeNumber: member.employeeNumber,
      email: member.email ?? '',
      phone: member.phone ?? '',
      department: member.department ?? '',
      designation: member.designation ?? '',
      category: member.category,
      status: member.status,
    });
    setError(null);
    setDialogOpen(true);
  };

  return (
    <Box sx={{ p: { xs: 2, md: 3 }, display: 'flex', flexDirection: 'column', gap: 3 }}>
      <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ xs: 'flex-start', sm: 'center' }} spacing={2}>
        <Box>
          <Typography variant="h5" fontWeight={700}>
            Staff & Teachers
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Teaching and non-teaching staff directory for the school
          </Typography>
        </Box>
        <Stack direction="row" spacing={2} alignItems="center">
          <TextField
            size="small"
            placeholder="Search staff…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <Button variant="contained" startIcon={<AddIcon />} onClick={openCreate} sx={{ textTransform: 'none' }}>
            Add Staff
          </Button>
        </Stack>
      </Stack>

      <Card>
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Name</TableCell>
                <TableCell>Employee No.</TableCell>
                <TableCell>Category</TableCell>
                <TableCell>Designation</TableCell>
                <TableCell>Contact</TableCell>
                <TableCell align="center">Status</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {(staff ?? []).map((member) => (
                <TableRow key={member.id} hover>
                  <TableCell>
                    <Typography variant="body2" fontWeight={700}>
                      {member.firstName} {member.lastName}
                    </Typography>
                  </TableCell>
                  <TableCell>{member.employeeNumber}</TableCell>
                  <TableCell>
                    <Chip label={member.category.replace('_', ' ')} size="small" />
                  </TableCell>
                  <TableCell>{member.designation ?? '—'}</TableCell>
                  <TableCell>
                    <Typography variant="caption" display="block">
                      {member.email ?? '—'}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {member.phone ?? ''}
                    </Typography>
                  </TableCell>
                  <TableCell align="center">
                    <Chip
                      label={member.status}
                      size="small"
                      color={member.status === 'ACTIVE' ? 'success' : 'default'}
                    />
                  </TableCell>
                  <TableCell align="right">
                    <IconButton size="small" onClick={() => openEdit(member)}>
                      <EditIcon fontSize="small" />
                    </IconButton>
                    <IconButton size="small" color="error" onClick={() => deleteMutation.mutate(member.id)}>
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))}
              {(staff ?? []).length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} align="center" sx={{ py: 6, color: 'text.secondary' }}>
                    No staff records yet. Add your first teacher or staff member.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Card>

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{form.id ? 'Edit Staff Member' : 'Add Staff Member'}</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2} sx={{ mt: 1 }}>
            {error && <Alert severity="error">{error}</Alert>}
            <Stack direction="row" spacing={2}>
              <TextField
                label="First name"
                value={form.firstName}
                onChange={(e) => setForm({ ...form, firstName: e.target.value })}
                fullWidth
              />
              <TextField
                label="Last name"
                value={form.lastName}
                onChange={(e) => setForm({ ...form, lastName: e.target.value })}
                fullWidth
              />
            </Stack>
            <TextField
              label="Employee number (auto if blank)"
              value={form.employeeNumber}
              onChange={(e) => setForm({ ...form, employeeNumber: e.target.value })}
            />
            <Stack direction="row" spacing={2}>
              <TextField
                label="Email"
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                fullWidth
              />
              <TextField
                label="Phone"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                fullWidth
              />
            </Stack>
            <Stack direction="row" spacing={2}>
              <TextField
                select
                label="Category"
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
                fullWidth
              >
                {SCHOOL_STAFF_CATEGORIES.map((c) => (
                  <MenuItem key={c} value={c}>
                    {c.replace('_', ' ')}
                  </MenuItem>
                ))}
              </TextField>
              <TextField
                select
                label="Status"
                value={form.status}
                onChange={(e) => setForm({ ...form, status: e.target.value })}
                fullWidth
              >
                <MenuItem value="ACTIVE">ACTIVE</MenuItem>
                <MenuItem value="INACTIVE">INACTIVE</MenuItem>
                <MenuItem value="SUSPENDED">SUSPENDED</MenuItem>
              </TextField>
            </Stack>
            <Stack direction="row" spacing={2}>
              <TextField
                label="Department"
                value={form.department}
                onChange={(e) => setForm({ ...form, department: e.target.value })}
                fullWidth
              />
              <TextField
                label="Designation"
                value={form.designation}
                onChange={(e) => setForm({ ...form, designation: e.target.value })}
                fullWidth
              />
            </Stack>
          </Stack>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setDialogOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            disabled={saveMutation.isPending || !form.firstName || !form.lastName}
            onClick={() => saveMutation.mutate()}
          >
            {saveMutation.isPending ? 'Saving…' : 'Save'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
