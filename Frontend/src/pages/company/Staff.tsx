import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Alert,
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  MenuItem,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material'
import AddIcon from '@mui/icons-material/Add'
import EditIcon from '@mui/icons-material/Edit'
import LockResetIcon from '@mui/icons-material/LockReset'
import IconButton from '@mui/material/IconButton'
import { staffApi, type StaffRecord, type UpdateStaffInput } from '../../api/staff'
import { branchesApi } from '../../api/branches'
import { departmentsApi } from '../../api/departments'
import { rolesApi } from '../../api/roles'
import { apiErrorMessage } from '../../api/client'
import { Can } from '../../components/PermissionGate'

export function StaffPage() {
  const qc = useQueryClient()
  const [creating, setCreating] = useState(false)
  const [editing, setEditing] = useState<StaffRecord | null>(null)
  const [tempPassword, setTempPassword] = useState('')
  const [resetTarget, setResetTarget] = useState<StaffRecord | null>(null)
  const [resetResult, setResetResult] = useState<{ message: string; temporaryToken?: string } | null>(null)

  const staff = useQuery({ queryKey: ['staff'], queryFn: () => staffApi.list() })
  const branches = useQuery({ queryKey: ['branches'], queryFn: () => branchesApi.list() })
  const roles = useQuery({ queryKey: ['roles'], queryFn: () => rolesApi.list() })

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['staff'] })
    qc.invalidateQueries({ queryKey: ['roles'] })
  }

  const create = useMutation({
    mutationFn: (body: Parameters<typeof staffApi.create>[0]) => staffApi.create(body),
    onSuccess: (res) => {
      setCreating(false)
      setTempPassword(res.temporaryPassword ?? '')
      invalidate()
    },
  })

  const reset = useMutation({
    mutationFn: (id: string) => staffApi.resetPassword(id),
    onSuccess: (res) => {
      setResetTarget(null)
      setResetResult(res)
    },
  })

  const rows = staff.data ?? []

  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2, flexWrap: 'wrap', gap: 1 }}>
        <Typography variant="h5" fontWeight={700}>Staff</Typography>
        <Can permissions={['staff.create']}>
          <Button variant="contained" startIcon={<AddIcon />} onClick={() => setCreating(true)}>
            Add staff
          </Button>
        </Can>
      </Stack>

      {create.error && <Alert severity="error" sx={{ mb: 2 }}>{apiErrorMessage(create.error)}</Alert>}
      {reset.error && <Alert severity="error" sx={{ mb: 2 }}>{apiErrorMessage(reset.error)}</Alert>}
      {tempPassword && (
        <Alert severity="info" sx={{ mb: 2 }} onClose={() => setTempPassword('')}>
          Staff created. Share this temporary password once: <strong>{tempPassword}</strong>
        </Alert>
      )}

      <TableContainer component={Paper} variant="outlined">
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Name</TableCell>
              <TableCell>Email</TableCell>
              <TableCell>Branch</TableCell>
              <TableCell>Department</TableCell>
              <TableCell>Job title</TableCell>
              <TableCell>Roles</TableCell>
              <TableCell>Status</TableCell>
              <TableCell align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.map((s) => (
              <TableRow key={s.id} hover>
                <TableCell>{s.user.firstName} {s.user.lastName}</TableCell>
                <TableCell>{s.user.email}</TableCell>
                <TableCell>{s.branch.name}</TableCell>
                <TableCell>{s.department?.name ?? '—'}</TableCell>
                <TableCell>{s.jobTitle ?? '—'}</TableCell>
                <TableCell>
                  {s.roles.map((r) => <Chip key={r.assignmentId ?? r.id} label={r.name} size="small" sx={{ mr: 0.5 }} />)}
                </TableCell>
                <TableCell><Chip label={s.isActive ? 'Active' : 'Inactive'} size="small" color={s.isActive ? 'success' : 'default'} /></TableCell>
                <TableCell align="right">
                  <Stack direction="row" justifyContent="flex-end">
                    <Can permissions={['staff.update']}>
                      <IconButton title="Edit staff" onClick={() => setEditing(s)}><EditIcon fontSize="small" /></IconButton>
                    </Can>
                    <Can permissions={['role.assign']}>
                      <IconButton title="Edit roles" onClick={() => setEditing(s)}><EditIcon fontSize="small" color="primary" /></IconButton>
                    </Can>
                    <Can permissions={['staff.update']}>
                      <IconButton title="Send password reset link" onClick={() => setResetTarget(s)} disabled={!s.isActive}><LockResetIcon fontSize="small" /></IconButton>
                    </Can>
                  </Stack>
                </TableCell>
              </TableRow>
            ))}
            {rows.length === 0 && <TableRow><TableCell colSpan={8} align="center">No staff</TableCell></TableRow>}
          </TableBody>
        </Table>
      </TableContainer>

      {creating && (
        <CreateStaffDialog
          open={creating}
          onClose={() => setCreating(false)}
          branches={(branches.data ?? []).map((b) => ({ id: b.id, name: b.name }))}
          roles={(roles.data ?? []).map((r) => ({ id: r.id, name: r.name, isSystem: r.isSystem }))}
          busy={create.isPending}
          onSave={(body) => create.mutate(body)}
        />
      )}

      {editing && (
        <EditStaffDialog
          open={editing !== null}
          staff={editing}
          branches={(branches.data ?? []).map((b) => ({ id: b.id, name: b.name }))}
          allRoles={(roles.data ?? []).map((r) => ({ id: r.id, name: r.name, isSystem: r.isSystem }))}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null)
            invalidate()
          }}
        />
      )}

      <Dialog open={resetTarget !== null} onClose={() => setResetTarget(null)}>
        <DialogTitle>Send password reset link</DialogTitle>
        <DialogContent>
          Send a password reset link to <strong>{resetTarget?.user.email}</strong>? They will need to set a new password via the emailed link.
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setResetTarget(null)} disabled={reset.isPending}>Cancel</Button>
          <Button variant="contained" startIcon={<LockResetIcon />} onClick={() => resetTarget && reset.mutate(resetTarget.id)} disabled={reset.isPending}>
            Send reset link
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={resetResult !== null} onClose={() => setResetResult(null)}>
        <DialogTitle>Password reset</DialogTitle>
        <DialogContent>
          {resetResult?.temporaryToken ? (
            <>
              <Alert severity="warning" sx={{ mb: 1.5 }}>
                No SMTP email service is configured, so the link was not emailed.
                Share this reset token with the user instead:
              </Alert>
              <Alert severity="info"><strong>{resetResult.temporaryToken}</strong></Alert>
            </>
          ) : (
            <Alert severity="success">{resetResult?.message ?? 'Password reset link sent.'}</Alert>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setResetResult(null)}>Close</Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}

function CreateStaffDialog({
  open,
  onClose,
  branches,
  roles,
  busy,
  onSave,
}: {
  open: boolean
  onClose: () => void
  branches: Array<{ id: string; name: string }>
  roles: Array<{ id: string; name: string; isSystem: boolean }>
  busy: boolean
  onSave: (body: Parameters<typeof staffApi.create>[0]) => void
}) {
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [email, setEmail] = useState('')
  const [branchId, setBranchId] = useState('')
  const [jobTitle, setJobTitle] = useState('')
  const [roleIds, setRoleIds] = useState<string[]>([])

  const editableRoles = roles.filter((r) => !r.isSystem)

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>Add staff</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ pt: 1 }}>
          <Stack direction="row" spacing={2}>
            <TextField label="First name" value={firstName} onChange={(e) => setFirstName(e.target.value)} fullWidth />
            <TextField label="Last name" value={lastName} onChange={(e) => setLastName(e.target.value)} fullWidth />
          </Stack>
          <TextField label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} fullWidth />
          <TextField select label="Branch" value={branchId} onChange={(e) => setBranchId(e.target.value)} fullWidth>
            {branches.map((b) => <MenuItem key={b.id} value={b.id}>{b.name}</MenuItem>)}
          </TextField>
          <TextField label="Job title" value={jobTitle} onChange={(e) => setJobTitle(e.target.value)} fullWidth />
          <TextField
            select
            label="Roles"
            value={roleIds}
            onChange={(e) => setRoleIds(e.target.value as unknown as string[])}
            fullWidth
            SelectProps={{ multiple: true }}
          >
            {editableRoles.map((r) => <MenuItem key={r.id} value={r.id}>{r.name}</MenuItem>)}
          </TextField>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button
          variant="contained"
          disabled={busy || !firstName || !lastName || !email || !branchId}
          onClick={() => onSave({ firstName, lastName, email, branchId, jobTitle: jobTitle || undefined, roleIds: roleIds.length ? roleIds : undefined })}
        >
          Create
        </Button>
      </DialogActions>
    </Dialog>
  )
}

function EditStaffDialog({
  open,
  staff,
  branches,
  allRoles,
  onClose,
  onSaved,
}: {
  open: boolean
  staff: StaffRecord
  branches: Array<{ id: string; name: string }>
  allRoles: Array<{ id: string; name: string; isSystem: boolean }>
  onClose: () => void
  onSaved: () => void
}) {
  const qc = useQueryClient()
  const [branchId, setBranchId] = useState(staff.branchId)
  const [departmentId, setDepartmentId] = useState<string | null>(staff.departmentId)
  const [jobTitle, setJobTitle] = useState(staff.jobTitle ?? '')
  const [employeeCode, setEmployeeCode] = useState(staff.employeeCode ?? '')
  const [isActive, setIsActive] = useState(staff.isActive)
  const [roleIds, setRoleIds] = useState<string[]>(staff.roles.map((r) => r.id))
  const [error, setError] = useState<string | null>(null)

  const departments = useQuery({
    queryKey: ['departments', branchId],
    queryFn: () => departmentsApi.list({ branchId }),
    enabled: !!branchId,
  })

  const update = useMutation({
    mutationFn: (body: UpdateStaffInput) => staffApi.update(staff.id, body),
  })

  const assignRoles = useMutation({
    mutationFn: (roleId: string) => staffApi.assignRoles(staff.id, [roleId], branchId),
  })

  const removeRole = useMutation({
    mutationFn: (assignmentId: string) => staffApi.removeRole(staff.id, assignmentId),
  })

  const saving =
    update.isPending || assignRoles.isPending || removeRole.isPending

  const handleSave = async () => {
    setError(null)
    try {
      const profileChanged =
        branchId !== staff.branchId ||
        (departmentId ?? null) !== staff.departmentId ||
        (jobTitle || null) !== (staff.jobTitle ?? null) ||
        (employeeCode || null) !== (staff.employeeCode ?? null) ||
        isActive !== staff.isActive
      if (profileChanged) {
        await update.mutateAsync({
          branchId,
          departmentId: departmentId || null,
          jobTitle: jobTitle || null,
          employeeCode: employeeCode || null,
          isActive,
        })
      }

      const currentRoleIds = staff.roles.map((r) => r.id)
      const toAdd = roleIds.filter((id) => !currentRoleIds.includes(id))
      const toRemove = staff.roles.filter((r) => !roleIds.includes(r.id) && r.assignmentId)

      for (const id of toAdd) {
        await assignRoles.mutateAsync(id)
      }
      for (const r of toRemove) {
        await removeRole.mutateAsync(r.assignmentId!)
      }

      await qc.invalidateQueries({ queryKey: ['staff'] })
      qc.invalidateQueries({ queryKey: ['roles'] })
      onSaved()
    } catch (err: any) {
      setError(apiErrorMessage(err))
    }
  }

  const editableRoles = allRoles.filter((r) => !r.isSystem)

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>Edit staff — {staff.user.firstName} {staff.user.lastName}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ pt: 1 }}>
          {error && <Alert severity="error">{error}</Alert>}
          <TextField label="Email" value={staff.user.email} disabled fullWidth />
          <TextField
            select
            label="Branch"
            value={branchId}
            onChange={(e) => {
              setBranchId(e.target.value)
              setDepartmentId(null)
            }}
            fullWidth
          >
            {branches.map((b) => <MenuItem key={b.id} value={b.id}>{b.name}</MenuItem>)}
          </TextField>
          <TextField
            select
            label="Department"
            value={departmentId ?? ''}
            onChange={(e) => setDepartmentId(e.target.value || null)}
            fullWidth
          >
            <MenuItem value="">— None —</MenuItem>
            {(departments.data ?? []).map((d) => <MenuItem key={d.id} value={d.id}>{d.name}</MenuItem>)}
          </TextField>
          <TextField label="Job title" value={jobTitle} onChange={(e) => setJobTitle(e.target.value)} fullWidth />
          <TextField label="Employee code" value={employeeCode} onChange={(e) => setEmployeeCode(e.target.value)} fullWidth />
          <TextField
            select
            label="Status"
            value={isActive ? 'active' : 'inactive'}
            onChange={(e) => setIsActive(e.target.value === 'active')}
            fullWidth
          >
            <MenuItem value="active">Active</MenuItem>
            <MenuItem value="inactive">Inactive</MenuItem>
          </TextField>
          <TextField
            select
            label="Roles"
            value={roleIds}
            onChange={(e) => setRoleIds(e.target.value as unknown as string[])}
            fullWidth
            SelectProps={{ multiple: true }}
          >
            {editableRoles.map((r) => <MenuItem key={r.id} value={r.id}>{r.name}</MenuItem>)}
          </TextField>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={saving}>Cancel</Button>
        <Button variant="contained" onClick={handleSave} disabled={saving}>
          {saving ? 'Saving…' : 'Save changes'}
        </Button>
      </DialogActions>
    </Dialog>
  )
}
