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
import { schoolApi, SCHOOL_STAFF_CATEGORIES, type SchoolStaffCategory, type SchoolStaffMember, type StaffAccountSummary } from '../../api/school';
import { rolesApi } from '../../api/roles';
import { Can } from '../../components/PermissionGate';
import { CopyButton } from '../../components/CopyButton';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { useToast } from '../../components/ToastProvider';

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
  roleId: string;
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
  roleId: '',
};

export function SchoolStaffPage() {
  const qc = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState<StaffForm>(EMPTY_FORM);
  const [search, setSearch] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [staffAccount, setStaffAccount] = useState<(StaffAccountSummary & { name: string }) | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<SchoolStaffMember | null>(null);
  const toast = useToast();

  const { data: staff } = useQuery({
    queryKey: ['school', 'staff', search],
    queryFn: () => schoolApi.listSchoolStaff({ search: search || undefined }),
  });

  const { data: roles } = useQuery({
    queryKey: ['roles'],
    queryFn: () => rolesApi.list(),
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
        roleId: form.roleId || null,
      };
      return form.id
        ? schoolApi.updateSchoolStaff(form.id, payload)
        : schoolApi.createSchoolStaff(payload);
    },
    onSuccess: (saved) => {
      setDialogOpen(false);
      setError(null);
      qc.invalidateQueries({ queryKey: ['school', 'staff'] });
      toast.success(form.id ? 'Staff member updated.' : 'Staff member added.');
      const account = (saved as { staffAccount?: StaffAccountSummary }).staffAccount;
      if (account) {
        setStaffAccount({ ...account, name: `${form.firstName} ${form.lastName}`.trim() });
      }
    },
    onError: (e: any) =>
      setError(e?.response?.data?.message ?? e?.message ?? 'Failed to save staff'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => schoolApi.deleteSchoolStaff(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['school', 'staff'] });
      setConfirmDelete(null);
      toast.success('Staff member removed.');
    },
    onError: (e: any) =>
      toast.error(e?.response?.data?.message ?? e?.message ?? 'Failed to remove staff'),
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
      roleId: member.user?.roleAssignments?.[0]?.companyRole?.id ?? '',
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
          <Can permissions={['school.manage', 'staff.create']}>
            <Button variant="contained" startIcon={<AddIcon />} onClick={openCreate} sx={{ textTransform: 'none' }}>
              Add Staff
            </Button>
          </Can>
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
                <TableCell>Role</TableCell>
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
                  <TableCell>
                    {member.user?.roleAssignments?.[0]?.companyRole?.name ? (
                      <Chip
                        label={member.user.roleAssignments[0].companyRole.name.replace('_', ' ')}
                        size="small"
                        color="primary"
                        variant="outlined"
                      />
                    ) : (
                      '—'
                    )}
                  </TableCell>
                  <TableCell>{member.designation ?? '—'}</TableCell>
                  <TableCell>
                    <Typography variant="caption" display="block" sx={{ wordBreak: 'break-all' }}>
                      {member.email ?? member.user?.email ?? '—'}
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
                    <Can permissions={['school.manage', 'staff.update']}>
                      <IconButton size="small" onClick={() => openEdit(member)}>
                        <EditIcon fontSize="small" />
                      </IconButton>
                    </Can>
                    <Can permissions={['school.manage', 'staff.delete']}>
                      <IconButton size="small" color="error" onClick={() => setConfirmDelete(member)}>
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </Can>
                  </TableCell>
                </TableRow>
              ))}
              {(staff ?? []).length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} align="center" sx={{ py: 6, color: 'text.secondary' }}>
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
            <TextField
              select
              label="Login role"
              value={form.roleId}
              onChange={(e) => setForm({ ...form, roleId: e.target.value })}
              helperText={
                form.id
                  ? 'Changing this updates the role on the staff member\u2019s login.'
                  : 'Leave blank to pick automatically from the category.'
              }
              fullWidth
            >
              <MenuItem value="">
                <em>Automatic (from category)</em>
              </MenuItem>
              {(roles ?? []).map((r) => (
                <MenuItem key={r.id} value={r.id}>
                  {r.name.replace('_', ' ')}
                </MenuItem>
              ))}
            </TextField>
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

      {/* Staff login credentials (created automatically) */}
      <Dialog open={!!staffAccount} onClose={() => setStaffAccount(null)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 700 }}>Staff Login Created</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2} sx={{ mt: 0.5 }}>
            <Typography variant="body2">
              A portal login was created for <strong>{staffAccount?.name}</strong>.
            </Typography>
            <Box>
              <Typography variant="caption" color="text.secondary">Login email</Typography>
              <Stack direction="row" alignItems="center" spacing={0.5}>
                <Typography variant="body1" fontWeight={700} sx={{ wordBreak: 'break-all' }}>
                  {staffAccount?.email}
                </Typography>
                <CopyButton value={staffAccount?.email ?? ''} label="Copy login email" />
              </Stack>
            </Box>
            <Box>
              <Typography variant="caption" color="text.secondary">Default password</Typography>
              <Stack direction="row" alignItems="center" spacing={0.5}>
                <Typography variant="body1" fontWeight={700}>
                  {staffAccount?.password ?? 'Unchanged (existing account)'}
                </Typography>
                {staffAccount?.password && (
                  <CopyButton value={staffAccount.password} label="Copy password" />
                )}
              </Stack>
            </Box>
            <Box>
              <Typography variant="caption" color="text.secondary">Role</Typography>
              <Typography variant="body1" fontWeight={700}>
                {(staffAccount?.role ?? '—').replace('_', ' ')}
              </Typography>
            </Box>
            <Typography variant="caption" color="text.secondary">
              Share these with the staff member. They can change the password after signing in.
            </Typography>
          </Stack>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button variant="contained" onClick={() => setStaffAccount(null)}>Done</Button>
        </DialogActions>
      </Dialog>

      <ConfirmDialog
        open={confirmDelete !== null}
        title="Remove staff member"
        message={
          <>
            Remove <strong>{confirmDelete?.firstName} {confirmDelete?.lastName}</strong> from the
            staff directory? Their portal login will be disabled.
          </>
        }
        confirmLabel="Remove"
        destructive
        pending={deleteMutation.isPending}
        onConfirm={() => confirmDelete && deleteMutation.mutate(confirmDelete.id)}
        onClose={() => setConfirmDelete(null)}
      />
    </Box>
  );
}
