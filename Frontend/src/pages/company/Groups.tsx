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
  Divider,
  IconButton,
  List,
  ListItem,
  ListItemText,
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
import DeleteIcon from '@mui/icons-material/Delete'
import GroupAddIcon from '@mui/icons-material/GroupAdd'
import { groupsApi, type StaffGroup } from '../../api/groups'
import { branchesApi } from '../../api/branches'
import { staffApi } from '../../api/staff'
import { apiErrorMessage } from '../../api/client'
import { Can } from '../../components/PermissionGate'

export function GroupsPage() {
  const qc = useQueryClient()
  const [branchFilter, setBranchFilter] = useState('')
  const [editing, setEditing] = useState<StaffGroup | null>(null)
  const [creating, setCreating] = useState(false)
  const [confirm, setConfirm] = useState<StaffGroup | null>(null)
  const [managing, setManaging] = useState<StaffGroup | null>(null)

  const branches = useQuery({ queryKey: ['branches'], queryFn: () => branchesApi.list() })
  const groups = useQuery({
    queryKey: ['groups', branchFilter],
    queryFn: () => groupsApi.list({ branchId: branchFilter || undefined }),
    enabled: branches.isSuccess,
  })

  const invalidate = () => qc.invalidateQueries({ queryKey: ['groups'] })

  const save = useMutation({
    mutationFn: (body: { branchId?: string; name: string; description?: string | null }) =>
      editing
        ? groupsApi.update(editing.id, { name: body.name, description: body.description ?? null })
        : groupsApi.create({ branchId: body.branchId ?? branchFilter, name: body.name, description: body.description ?? null }),
    onSuccess: () => { setCreating(false); setEditing(null); invalidate() },
  })

  const remove = useMutation({
    mutationFn: (id: string) => groupsApi.remove(id),
    onSuccess: () => { setConfirm(null); invalidate() },
  })

  const rows = groups.data ?? []

  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2, flexWrap: 'wrap', gap: 1 }}>
        <Typography variant="h5" fontWeight={700}>Groups</Typography>
        <Can permissions={['group.create']}>
          <Button variant="contained" startIcon={<AddIcon />} onClick={() => { setEditing(null); setCreating(true) }}>
            New group
          </Button>
        </Can>
      </Stack>

      <TextField select label="Filter by branch" value={branchFilter} onChange={(e) => setBranchFilter(e.target.value)} size="small" sx={{ mb: 2, minWidth: 220, width: { xs: '100%', sm: 'auto' } }}>
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
              <TableCell>Description</TableCell>
              <TableCell>Members</TableCell>
              <TableCell align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.map((g) => (
              <TableRow key={g.id} hover>
                <TableCell>{g.name}</TableCell>
                <TableCell>{branches.data?.find((b) => b.id === g.branchId)?.name ?? '—'}</TableCell>
                <TableCell>{g.description ?? '—'}</TableCell>
                <TableCell><Chip label={g._count?.staffGroups ?? 0} size="small" /></TableCell>
                <TableCell align="right">
                  <Can permissions={['group.update']}>
                    <IconButton title="Manage members" onClick={() => setManaging(g)}><GroupAddIcon fontSize="small" /></IconButton>
                    <IconButton onClick={() => { setEditing(g); setCreating(true) }}><EditIcon fontSize="small" /></IconButton>
                  </Can>
                  <Can permissions={['group.delete']}>
                    <IconButton color="error" onClick={() => setConfirm(g)}><DeleteIcon fontSize="small" /></IconButton>
                  </Can>
                </TableCell>
              </TableRow>
            ))}
            {rows.length === 0 && <TableRow><TableCell colSpan={5} align="center">No groups</TableCell></TableRow>}
          </TableBody>
        </Table>
      </TableContainer>

      {(creating || editing) && (
        <GroupDialog
          group={editing}
          open
          defaultBranchId={branchFilter}
          branchOptions={(branches.data ?? []).map((b) => ({ id: b.id, name: b.name }))}
          onClose={() => { setCreating(false); setEditing(null) }}
          onSave={(body) => save.mutate(body)}
          busy={save.isPending}
        />
      )}

      {managing && (
        <MembersDialog
          group={managing}
          onClose={() => setManaging(null)}
          onChanged={() => invalidate()}
        />
      )}

      <Dialog open={confirm !== null} onClose={() => setConfirm(null)}>
        <DialogTitle>Delete group</DialogTitle>
        <DialogContent>Delete "{confirm?.name}"?</DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirm(null)}>Cancel</Button>
          <Button color="error" onClick={() => confirm && remove.mutate(confirm.id)}>Delete</Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}

function GroupDialog({
  group,
  open,
  defaultBranchId,
  branchOptions,
  onClose,
  onSave,
  busy,
}: {
  group: StaffGroup | null
  open: boolean
  defaultBranchId: string
  branchOptions: Array<{ id: string; name: string }>
  onClose: () => void
  onSave: (body: { branchId?: string; name: string; description?: string | null }) => void
  busy: boolean
}) {
  const [branchId, setBranchId] = useState(defaultBranchId || group?.branchId || '')
  const [name, setName] = useState(group?.name ?? '')
  const [description, setDescription] = useState(group?.description ?? '')
  const isCreate = !group

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle>{group ? 'Edit group' : 'New group'}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ pt: 1 }}>
          {isCreate && (
            <TextField select label="Branch" value={branchId} onChange={(e) => setBranchId(e.target.value)} fullWidth>
              {branchOptions.map((b) => <MenuItem key={b.id} value={b.id}>{b.name}</MenuItem>)}
            </TextField>
          )}
          <TextField label="Name" value={name} onChange={(e) => setName(e.target.value)} fullWidth />
          <TextField label="Description" value={description} onChange={(e) => setDescription(e.target.value)} fullWidth multiline minRows={2} />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" disabled={busy || !name || (isCreate && !branchId)} onClick={() => onSave({ branchId, name, description: description || null })}>
          Save
        </Button>
      </DialogActions>
    </Dialog>
  )
}

function MembersDialog({
  group,
  onClose,
  onChanged,
}: {
  group: StaffGroup
  onClose: () => void
  onChanged: () => void
}) {
  const qc = useQueryClient()
  const [adding, setAdding] = useState('')
  const [error, setError] = useState('')

  const detail = useQuery({
    queryKey: ['groups', group.id],
    queryFn: () => groupsApi.get(group.id),
  })
  const staff = useQuery({ queryKey: ['staff'], queryFn: () => staffApi.list() })

  const add = useMutation({
    mutationFn: (staffRecordId: string) => groupsApi.addMembers(group.id, [staffRecordId]),
    onSuccess: () => { setAdding(''); onChanged(); qc.invalidateQueries({ queryKey: ['groups', group.id] }) },
    onError: (e) => setError(apiErrorMessage(e)),
  })

  const removeMember = useMutation({
    mutationFn: (staffRecordId: string) => groupsApi.removeMember(group.id, staffRecordId),
    onSuccess: () => { onChanged(); qc.invalidateQueries({ queryKey: ['groups', group.id] }) },
    onError: (e) => setError(apiErrorMessage(e)),
  })

  const memberIds = new Set((detail.data?.members ?? []).map((m) => m.id))
  const candidate = (staff.data ?? []).filter((s) => !memberIds.has(s.id) && s.branchId === group.branchId)

  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>Members of {group.name}</DialogTitle>
      <DialogContent>
        {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>{error}</Alert>}
        <Stack direction="row" spacing={1} sx={{ mb: 2 }}>
          <TextField select label="Add staff member" size="small" fullWidth value={adding} onChange={(e) => setAdding(e.target.value)}>
            <MenuItem value="">Select staff…</MenuItem>
            {candidate.map((s) => (
              <MenuItem key={s.id} value={s.id}>{s.user.firstName} {s.user.lastName} — {s.jobTitle ?? '—'}</MenuItem>
            ))}
          </TextField>
          <Button variant="contained" disabled={!adding} onClick={() => adding && add.mutate(adding)}>Add</Button>
        </Stack>
        <Divider sx={{ mb: 1 }} />
        <List dense>
          {(detail.data?.members ?? []).map((m) => (
            <ListItem key={m.id} secondaryAction={
              <Can permissions={['group.update']}>
                <IconButton edge="end" size="small" color="error" onClick={() => removeMember.mutate(m.id)}><DeleteIcon fontSize="small" /></IconButton>
              </Can>
            }>
              <ListItemText primary={`${m.user.firstName} ${m.user.lastName}`} secondary={m.user.email} />
            </ListItem>
          ))}
          {(detail.data?.members ?? []).length === 0 && <ListItem><ListItemText primary="No members yet." /></ListItem>}
        </List>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  )
}
