import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  IconButton,
  InputLabel,
  MenuItem,
  Paper,
  Select,
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
import DeleteIcon from '@mui/icons-material/Delete'
import { departmentsApi, type Department } from '../../api/departments'
import { branchesApi } from '../../api/branches'
import { staffApi } from '../../api/staff'
import { apiErrorMessage } from '../../api/client'
import { Can } from '../../components/PermissionGate'

export function DepartmentsPage() {
  const qc = useQueryClient()
  const [branchFilter, setBranchFilter] = useState('')
  const [editing, setEditing] = useState<Department | null>(null)
  const [creating, setCreating] = useState(false)
  const [confirm, setConfirm] = useState<Department | null>(null)

  const branches = useQuery({ queryKey: ['branches'], queryFn: () => branchesApi.list() })
  const departments = useQuery({
    queryKey: ['departments', branchFilter],
    queryFn: () => departmentsApi.list({ branchId: branchFilter || undefined }),
    enabled: branches.isSuccess,
  })
  const staff = useQuery({ queryKey: ['staff'], queryFn: () => staffApi.list() })

  const invalidate = () => qc.invalidateQueries({ queryKey: ['departments'] })

  const save = useMutation({
    mutationFn: (body: { branchId?: string; name: string; managerUserId?: string | null }) =>
      editing
        ? departmentsApi.update(editing.id, { name: body.name, managerUserId: body.managerUserId ?? null })
        : departmentsApi.create({ branchId: body.branchId ?? branchFilter, name: body.name, managerUserId: body.managerUserId ?? null }),
    onSuccess: () => { setCreating(false); setEditing(null); invalidate() },
  })

  const remove = useMutation({
    mutationFn: (id: string) => departmentsApi.remove(id),
    onSuccess: () => { setConfirm(null); invalidate() },
  })

  const rows = departments.data ?? []
  const managerOptions = (staff.data ?? []).filter((s) => !branchFilter || s.branchId === branchFilter)

  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2, flexWrap: 'wrap', gap: 1 }}>
        <Typography variant="h5" fontWeight={700}>Departments</Typography>
        <Can permissions={['department.create']}>
          <Button variant="contained" startIcon={<AddIcon />} onClick={() => { setEditing(null); setCreating(true) }}>
            New department
          </Button>
        </Can>
      </Stack>

      <TextField select label="Filter by branch" value={branchFilter} onChange={(e) => setBranchFilter(e.target.value)} size="small" sx={{ mb: 2, minWidth: 220, width: { xs: '100%', sm: 'auto' } }} >
        <MenuItem value="">All branches</MenuItem>
        {(branches.data ?? []).map((b) => <MenuItem key={b.id} value={b.id}>{b.name}</MenuItem>)}
      </TextField>

      {(save.error || remove.error) && <Alert severity="error" sx={{ mb: 2 }}>{apiErrorMessage(save.error ?? remove.error)}</Alert>}

      <TableContainer component={Paper} variant="outlined">
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Name</TableCell>
              <TableCell>Branch</TableCell>
              <TableCell>Manager</TableCell>
              <TableCell align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.map((d) => {
              const manager = staff.data?.find((s) => s.user.id === d.managerUserId)
              return (
                <TableRow key={d.id} hover>
                  <TableCell>{d.name}</TableCell>
                  <TableCell>{branches.data?.find((b) => b.id === d.branchId)?.name ?? '—'}</TableCell>
                  <TableCell>{manager ? `${manager.user.firstName} ${manager.user.lastName}` : '—'}</TableCell>
                  <TableCell align="right">
                    <Can permissions={['department.update']}>
                      <IconButton onClick={() => { setEditing(d); setCreating(true) }}><EditIcon fontSize="small" /></IconButton>
                    </Can>
                    <Can permissions={['department.delete']}>
                      <IconButton color="error" onClick={() => setConfirm(d)}><DeleteIcon fontSize="small" /></IconButton>
                    </Can>
                  </TableCell>
                </TableRow>
              )
            })}
            {rows.length === 0 && <TableRow><TableCell colSpan={4} align="center">No departments</TableCell></TableRow>}
          </TableBody>
        </Table>
      </TableContainer>

      {(creating || editing) && (
        <DepartmentDialog
          department={editing}
          open
          defaultBranchId={branchFilter}
          branchOptions={(branches.data ?? []).map((b) => ({ id: b.id, name: b.name }))}
          managerOptions={managerOptions.map((m) => ({ id: m.id, userId: m.user.id, name: `${m.user.firstName} ${m.user.lastName}` }))}
          onClose={() => { setCreating(false); setEditing(null) }}
          onSave={(body) => save.mutate(body)}
          busy={save.isPending}
        />
      )}

      <Dialog open={confirm !== null} onClose={() => setConfirm(null)}>
        <DialogTitle>Delete department</DialogTitle>
        <DialogContent>Delete "{confirm?.name}"? Staff assigned to it will not be deleted.</DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirm(null)}>Cancel</Button>
          <Button color="error" onClick={() => confirm && remove.mutate(confirm.id)}>Delete</Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}

function DepartmentDialog({
  department,
  open,
  defaultBranchId,
  branchOptions,
  managerOptions,
  onClose,
  onSave,
  busy,
}: {
  department: Department | null
  open: boolean
  defaultBranchId: string
  branchOptions: Array<{ id: string; name: string }>
  managerOptions: Array<{ id: string; userId: string; name: string }>
  onClose: () => void
  onSave: (body: { branchId?: string; name: string; managerUserId?: string | null }) => void
  busy: boolean
}) {
  const [branchId, setBranchId] = useState(defaultBranchId || department?.branchId || '')
  const [name, setName] = useState(department?.name ?? '')
  const [managerUserId, setManagerUserId] = useState(department?.managerUserId ?? '')
  const isCreate = !department

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle>{department ? 'Edit department' : 'New department'}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ pt: 1 }}>
          {isCreate && (
            <TextField select label="Branch" value={branchId} onChange={(e) => setBranchId(e.target.value)} fullWidth>
              {branchOptions.map((b) => <MenuItem key={b.id} value={b.id}>{b.name}</MenuItem>)}
            </TextField>
          )}
          <TextField label="Name" value={name} onChange={(e) => setName(e.target.value)} fullWidth />
          <FormControl>
            <InputLabel>Manager</InputLabel>
            <Select label="Manager" value={managerUserId} onChange={(e) => setManagerUserId(e.target.value)}>
              <MenuItem value="">No manager</MenuItem>
              {managerOptions.map((m) => <MenuItem key={m.id} value={m.userId}>{m.name}</MenuItem>)}
            </Select>
          </FormControl>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" disabled={busy || !name || (isCreate && !branchId)} onClick={() => onSave({ branchId, name, managerUserId: managerUserId || null })}>
          Save
        </Button>
      </DialogActions>
    </Dialog>
  )
}
