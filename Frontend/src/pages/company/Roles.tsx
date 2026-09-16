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
  FormControlLabel,
  IconButton,
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
import DeleteIcon from '@mui/icons-material/Delete'
import { rolesApi, type CompanyRole } from '../../api/roles'
import { permissionsApi, type PermissionCatalog } from '../../api/permissions'
import { apiErrorMessage } from '../../api/client'
import { Can } from '../../components/PermissionGate'

export function RolesPage() {
  const qc = useQueryClient()
  const [editing, setEditing] = useState<CompanyRole | null>(null)
  const [creating, setCreating] = useState(false)
  const [confirm, setConfirm] = useState<CompanyRole | null>(null)

  const roles = useQuery({ queryKey: ['roles'], queryFn: () => rolesApi.list() })
  const catalog = useQuery<PermissionCatalog>({ queryKey: ['permission-catalog'], queryFn: () => permissionsApi.catalog() })
  const invalidate = () => qc.invalidateQueries({ queryKey: ['roles'] })

  const save = useMutation({
    mutationFn: (body: { name: string; description?: string | null; permissions: string[] }) =>
      editing ? rolesApi.update(editing.id, body) : rolesApi.create(body),
    onSuccess: () => { setCreating(false); setEditing(null); invalidate() },
  })

  const remove = useMutation({
    mutationFn: (id: string) => rolesApi.remove(id),
    onSuccess: () => { setConfirm(null); invalidate() },
  })

  const rows = roles.data ?? []

  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2, flexWrap: 'wrap', gap: 1 }}>
        <Typography variant="h5" fontWeight={700}>Roles</Typography>
        <Can permissions={['role.create']}>
          <Button variant="contained" startIcon={<AddIcon />} onClick={() => { setEditing(null); setCreating(true) }}>
            New role
          </Button>
        </Can>
      </Stack>

      {(save.error || remove.error) && <Alert severity="error" sx={{ mb: 2 }}>{apiErrorMessage(save.error ?? remove.error)}</Alert>}

      <TableContainer component={Paper} variant="outlined">
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Name</TableCell>
              <TableCell>Description</TableCell>
              <TableCell align="right">Permissions</TableCell>
              <TableCell align="right">Members</TableCell>
              <TableCell align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.map((r) => (
              <TableRow key={r.id} hover>
                <TableCell>
                  {r.name}
                  {r.isSystem && <Chip label="System" size="small" color="primary" sx={{ ml: 1 }} />}
                </TableCell>
                <TableCell>{r.description ?? '—'}</TableCell>
                <TableCell align="right"><Chip label={r.permissions.length} size="small" /></TableCell>
                <TableCell align="right">{r._count?.assignments ?? 0}</TableCell>
                <TableCell align="right">
                  <Can permissions={['role.update']}>
                    <IconButton onClick={() => { setEditing(r); setCreating(true) }} disabled={r.isSystem}><EditIcon fontSize="small" /></IconButton>
                  </Can>
                  <Can permissions={['role.delete']}>
                    <IconButton color="error" onClick={() => setConfirm(r)} disabled={r.isSystem}><DeleteIcon fontSize="small" /></IconButton>
                  </Can>
                </TableCell>
              </TableRow>
            ))}
            {rows.length === 0 && <TableRow><TableCell colSpan={5} align="center">No roles</TableCell></TableRow>}
          </TableBody>
        </Table>
      </TableContainer>

      {(creating || editing) && (
        <RoleDialog
          role={editing}
          open
          onClose={() => { setCreating(false); setEditing(null) }}
          onSave={(body) => save.mutate(body)}
          busy={save.isPending}
          catalog={catalog.data}
        />
      )}

      <Dialog open={confirm !== null} onClose={() => setConfirm(null)}>
        <DialogTitle>Delete role</DialogTitle>
        <DialogContent>Delete role "{confirm?.name}"?</DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirm(null)}>Cancel</Button>
          <Button color="error" onClick={() => confirm && remove.mutate(confirm.id)}>Delete</Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}

function RoleDialog({
  role,
  open,
  onClose,
  onSave,
  busy,
  catalog,
}: {
  role: CompanyRole | null
  open: boolean
  onClose: () => void
  onSave: (body: { name: string; description?: string | null; permissions: string[] }) => void
  busy: boolean
  catalog?: PermissionCatalog
}) {
  const [name, setName] = useState(role?.name ?? '')
  const [description, setDescription] = useState(role?.description ?? '')
  const [selected, setSelected] = useState<string[]>(role?.permissions ?? [])
  const groups = catalog?.grouped ?? {}

  function toggle(perm: string) {
    setSelected((s) => (s.includes(perm) ? s.filter((p) => p !== perm) : [...s, perm]))
  }

  function toggleGroup(groupKeys: string[]) {
    const allOn = groupKeys.every((k) => selected.includes(k))
    setSelected((s) => {
      const filtered = s.filter((k) => !groupKeys.includes(k))
      return allOn ? filtered : [...filtered, ...groupKeys]
    })
  }

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>{role ? 'Edit role' : 'New role'}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ pt: 1 }}>
          <TextField label="Name" value={name} onChange={(e) => setName(e.target.value)} fullWidth />
          <TextField label="Description" value={description} onChange={(e) => setDescription(e.target.value)} fullWidth multiline rows={2} />
          <Stack spacing={1}>
            <Typography variant="subtitle2">Permissions</Typography>
            {Object.entries(groups).map(([group, perms]) => (
              <Paper key={group} variant="outlined" sx={{ p: 1 }}>
                <FormControlLabel
                  control={<Checkbox checked={perms.every((p) => selected.includes(p))} indeterminate={perms.some((p) => selected.includes(p)) && !perms.every((p) => selected.includes(p))} />}
                  label={group}
                  onClick={() => toggleGroup(perms)}
                />
                <Stack direction="row" flexWrap="wrap" sx={{ pl: 3 }}>
                  {perms.map((p) => (
                    <FormControlLabel
                      key={p}
                      control={<Checkbox size="small" checked={selected.includes(p)} onChange={() => toggle(p)} />}
                      label={<Typography variant="caption">{p}</Typography>}
                      sx={{ mr: 1 }}
                    />
                  ))}
                </Stack>
              </Paper>
            ))}
          </Stack>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button
          variant="contained"
          disabled={busy || !name}
          onClick={() => onSave({ name, description: description || null, permissions: selected })}
        >
          Save
        </Button>
      </DialogActions>
    </Dialog>
  )
}
