import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Alert,
  Box,
  Button,
  Checkbox,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  MenuItem,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TablePagination,
  TableRow,
  TextField,
  Typography,
} from '@mui/material'
import AddIcon from '@mui/icons-material/Add'
import EditIcon from '@mui/icons-material/Edit'
import DeleteIcon from '@mui/icons-material/Delete'
import KeyIcon from '@mui/icons-material/Key'
import LockResetIcon from '@mui/icons-material/LockReset'
import { platformApi, type PlatformUser } from '../../api/platform'
import { apiErrorMessage } from '../../api/client'
import { useAuthStore } from '../../store/auth'

const SUPER_ADMIN = 'SUPER_ADMIN'

export function UsersPage() {
  const qc = useQueryClient()
  const me = useAuthStore((s) => s.user)
  const isSuper = me?.role === SUPER_ADMIN
  const [page, setPage] = useState(0)
  const [rowsPerPage, setRowsPerPage] = useState(20)
  const [editing, setEditing] = useState<PlatformUser | null>(null)
  const [creating, setCreating] = useState(false)
  const [confirm, setConfirm] = useState<PlatformUser | null>(null)
  const [tempPassword, setTempPassword] = useState('')
  const [resetTarget, setResetTarget] = useState<PlatformUser | null>(null)
  const [resetResult, setResetResult] = useState<{ message: string; temporaryToken?: string } | null>(null)

  const users = useQuery({
    queryKey: ['platform', 'users', page, rowsPerPage],
    queryFn: () => platformApi.users({ limit: rowsPerPage, offset: page * rowsPerPage }),
  })

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['platform', 'users'] })
  }

  const create = useMutation({
    mutationFn: (body: { email: string; firstName: string; lastName: string; role: string }) =>
      platformApi.createUser(body),
    onSuccess: (res) => {
      setCreating(false)
      setTempPassword(res.temporaryPassword ?? '')
      invalidate()
    },
  })

  const update = useMutation({
    mutationFn: (body: { id: string; firstName?: string; lastName?: string; role?: string; isActive?: boolean }) =>
      platformApi.updateUser(body.id, body),
    onSuccess: () => {
      setEditing(null)
      invalidate()
    },
  })

  const remove = useMutation({
    mutationFn: (id: string) => platformApi.deleteUser(id),
    onSuccess: () => {
      setConfirm(null)
      invalidate()
    },
  })

  const reset = useMutation({
    mutationFn: (id: string) => platformApi.resetUserPassword(id),
    onSuccess: (res) => {
      setResetTarget(null)
      setResetResult(res)
    },
  })

  const rows = users.data?.items ?? []

  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2, flexWrap: 'wrap', gap: 1 }}>
        <Typography variant="h5" fontWeight={700}>Platform Users</Typography>
        {isSuper && (
          <Button variant="contained" startIcon={<AddIcon />} onClick={() => { setEditing(null); setCreating(true) }}>
            New user
          </Button>
        )}
      </Stack>

      {(create.error || update.error || remove.error || reset.error) && (
        <Alert severity="error" sx={{ mb: 2 }}>{apiErrorMessage(create.error ?? update.error ?? remove.error ?? reset.error)}</Alert>
      )}

      {tempPassword && (
        <Alert severity="info" sx={{ mb: 2 }} onClose={() => setTempPassword('')}>
          Temporary password (share once): <strong>{tempPassword}</strong>
        </Alert>
      )}

      <TableContainer component={Paper} variant="outlined" sx={{ overflowX: 'auto' }}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Name</TableCell>
              <TableCell>Email</TableCell>
              <TableCell>Role</TableCell>
              <TableCell>Active</TableCell>
              <TableCell align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.map((u) => (
              <TableRow key={u.id} hover>
                <TableCell>{u.firstName} {u.lastName}</TableCell>
                <TableCell>{u.email}</TableCell>
                <TableCell><Chip label={u.role} size="small" color={u.role === SUPER_ADMIN ? 'secondary' : 'default'} /></TableCell>
                <TableCell>{u.isActive ? <Chip label="Active" size="small" color="success" /> : <Chip label="Inactive" size="small" color="default" />}</TableCell>
                <TableCell align="right">
                  {isSuper && (
                    <>
                      <IconButton onClick={() => { setEditing(u); setCreating(true) }}><EditIcon fontSize="small" /></IconButton>
                      <IconButton title="Send password reset link" onClick={() => setResetTarget(u)} disabled={!u.isActive}><LockResetIcon fontSize="small" /></IconButton>
                      <IconButton color="error" onClick={() => setConfirm(u)} disabled={u.id === me?.id}><DeleteIcon fontSize="small" /></IconButton>
                    </>
                  )}
                </TableCell>
              </TableRow>
            ))}
            {rows.length === 0 && <TableRow><TableCell colSpan={5} align="center">No users</TableCell></TableRow>}
          </TableBody>
        </Table>
      </TableContainer>

      <TablePagination
        component="div"
        count={users.data?.total ?? 0}
        rowsPerPageOptions={[10, 20, 50]}
        rowsPerPage={rowsPerPage}
        page={page}
        onPageChange={(_, p) => setPage(p)}
        onRowsPerPageChange={(e) => { setRowsPerPage(parseInt(e.target.value, 10)); setPage(0) }}
      />

      {creating && (
        <UserEditDialog
          user={editing}
          open={creating}
          onClose={() => { setCreating(false); setEditing(null) }}
          onSave={(body) =>
            editing
              ? update.mutate({ id: editing.id, firstName: body.firstName, lastName: body.lastName, role: body.role, isActive: body.isActive })
              : create.mutate({ email: body.email, firstName: body.firstName, lastName: body.lastName, role: body.role })
          }
          busy={create.isPending || update.isPending}
        />
      )}

      <Dialog open={confirm !== null} onClose={() => setConfirm(null)} fullWidth maxWidth="xs">
        <DialogTitle>Delete user</DialogTitle>
        <DialogContent>Delete {confirm?.firstName} {confirm?.lastName}? This cannot be undone.</DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirm(null)}>Cancel</Button>
          <Button color="error" onClick={() => confirm && remove.mutate(confirm.id)}>Delete</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={resetTarget !== null} onClose={() => setResetTarget(null)} fullWidth maxWidth="xs">
        <DialogTitle>Send password reset link</DialogTitle>
        <DialogContent>
          Send a password reset link to <strong>{resetTarget?.email}</strong>? They will need to set a new password via the emailed link.
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setResetTarget(null)} disabled={reset.isPending}>Cancel</Button>
          <Button variant="contained" startIcon={<KeyIcon />} onClick={() => resetTarget && reset.mutate(resetTarget.id)} disabled={reset.isPending}>
            Send reset link
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={resetResult !== null} onClose={() => setResetResult(null)} fullWidth maxWidth="xs">
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

function UserEditDialog({
  user,
  open,
  onClose,
  onSave,
  busy,
}: {
  user: PlatformUser | null
  open: boolean
  onClose: () => void
  onSave: (body: { email: string; firstName: string; lastName: string; role: string; isActive?: boolean }) => void
  busy: boolean
}) {
  const [firstName, setFirstName] = useState(user?.firstName ?? '')
  const [lastName, setLastName] = useState(user?.lastName ?? '')
  const [email, setEmail] = useState(user?.email ?? '')
  const [role, setRole] = useState<PlatformUser['role']>(user?.role ?? SUPER_ADMIN)
  const [isActive, setIsActive] = useState(user?.isActive ?? true)

  return (
      <Dialog open={open} onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle>{user ? 'Edit user' : 'New platform user'}</DialogTitle>
      <DialogContent sx={{ px: { xs: 2, sm: 3 }, pt: { xs: 1.5, sm: 2 } }}>
        <Stack spacing={2} sx={{ pt: 1 }}>
          <TextField label="First name" value={firstName} onChange={(e) => setFirstName(e.target.value)} fullWidth />
          <TextField label="Last name" value={lastName} onChange={(e) => setLastName(e.target.value)} fullWidth />
          {!user && <TextField label="Email" value={email} onChange={(e) => setEmail(e.target.value)} fullWidth />}
          <TextField select label="Role" value={role} onChange={(e) => setRole(e.target.value as PlatformUser['role'])} fullWidth>
            <MenuItem value={SUPER_ADMIN}>Super Admin</MenuItem>
            <MenuItem value="PLATFORM_SUPPORT">Platform Support</MenuItem>
          </TextField>
          {user && (
            <Stack direction="row" alignItems="center">
              <Checkbox checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
              <Typography variant="body2">Active</Typography>
            </Stack>
          )}
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: { xs: 2, sm: 3 }, pb: { xs: 2, sm: 2 }, flexWrap: 'wrap' }}>
        <Button onClick={onClose}>Cancel</Button>
        <Button
          variant="contained"
          disabled={busy || !firstName || !lastName || (!user && !email)}
          onClick={() => onSave({ email, firstName, lastName, role, isActive })}
        >
          Save
        </Button>
      </DialogActions>
    </Dialog>
  )
}
