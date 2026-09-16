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
import { branchesApi, type Branch } from '../../api/branches'
import { apiErrorMessage } from '../../api/client'
import { Can } from '../../components/PermissionGate'

export function BranchesPage() {
  const qc = useQueryClient()
  const [editing, setEditing] = useState<Branch | null>(null)
  const [creating, setCreating] = useState(false)
  const [confirm, setConfirm] = useState<Branch | null>(null)

  const branches = useQuery({ queryKey: ['branches'], queryFn: () => branchesApi.list() })
  const invalidate = () => qc.invalidateQueries({ queryKey: ['branches'] })

  const save = useMutation({
    mutationFn: (body: { name: string; address: string; latitude: number; longitude: number }) =>
      editing ? branchesApi.update(editing.id, body) : branchesApi.create(body),
    onSuccess: () => { setCreating(false); setEditing(null); invalidate() },
  })

  const remove = useMutation({
    mutationFn: (id: string) => branchesApi.remove(id),
    onSuccess: () => { setConfirm(null); invalidate() },
  })

  const rows = branches.data ?? []

  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2, flexWrap: 'wrap', gap: 1 }}>
        <Typography variant="h5" fontWeight={700}>Branches</Typography>
        <Can permissions={['branch.create']}>
          <Button variant="contained" startIcon={<AddIcon />} onClick={() => { setEditing(null); setCreating(true) }}>
            New branch
          </Button>
        </Can>
      </Stack>

      {(save.error || remove.error) && <Alert severity="error" sx={{ mb: 2 }}>{apiErrorMessage(save.error ?? remove.error)}</Alert>}

      <TableContainer component={Paper} variant="outlined">
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Name</TableCell>
              <TableCell>Address</TableCell>
              <TableCell>Status</TableCell>
              <TableCell align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.map((b) => (
              <TableRow key={b.id} hover>
                <TableCell>{b.name}</TableCell>
                <TableCell>{b.address}</TableCell>
                <TableCell><Chip label={b.status} size="small" color={b.status === 'ACTIVE' ? 'success' : 'default'} /></TableCell>
                <TableCell align="right">
                  <Can permissions={['branch.update']}>
                    <IconButton onClick={() => { setEditing(b); setCreating(true) }}><EditIcon fontSize="small" /></IconButton>
                  </Can>
                  <Can permissions={['branch.delete']}>
                    <IconButton color="error" onClick={() => setConfirm(b)}><DeleteIcon fontSize="small" /></IconButton>
                  </Can>
                </TableCell>
              </TableRow>
            ))}
            {rows.length === 0 && <TableRow><TableCell colSpan={4} align="center">No branches</TableCell></TableRow>}
          </TableBody>
        </Table>
      </TableContainer>

      {(creating || editing) && (
        <BranchDialog
          branch={editing}
          open
          onClose={() => { setCreating(false); setEditing(null) }}
          onSave={(body) => save.mutate(body)}
          busy={save.isPending}
        />
      )}

      <Dialog open={confirm !== null} onClose={() => setConfirm(null)}>
        <DialogTitle>Delete branch</DialogTitle>
        <DialogContent>Delete "{confirm?.name}"? Related records may be affected.</DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirm(null)}>Cancel</Button>
          <Button color="error" onClick={() => confirm && remove.mutate(confirm.id)}>Delete</Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}

function BranchDialog({
  branch,
  open,
  onClose,
  onSave,
  busy,
}: {
  branch: Branch | null
  open: boolean
  onClose: () => void
  onSave: (body: { name: string; address: string; latitude: number; longitude: number }) => void
  busy: boolean
}) {
  const [name, setName] = useState(branch?.name ?? '')
  const [address, setAddress] = useState(branch?.address ?? '')
  const [latitude, setLatitude] = useState(branch?.latitude?.toString() ?? '0')
  const [longitude, setLongitude] = useState(branch?.longitude?.toString() ?? '0')

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle>{branch ? 'Edit branch' : 'New branch'}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ pt: 1 }}>
          <TextField label="Name" value={name} onChange={(e) => setName(e.target.value)} fullWidth />
          <TextField label="Address" value={address} onChange={(e) => setAddress(e.target.value)} fullWidth />
          <Stack direction="row" spacing={2}>
            <TextField label="Latitude" type="number" value={latitude} onChange={(e) => setLatitude(e.target.value)} fullWidth />
            <TextField label="Longitude" type="number" value={longitude} onChange={(e) => setLongitude(e.target.value)} fullWidth />
          </Stack>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button
          variant="contained"
          disabled={busy || !name || !address}
          onClick={() => onSave({ name, address, latitude: parseFloat(latitude || '0'), longitude: parseFloat(longitude || '0') })}
        >
          Save
        </Button>
      </DialogActions>
    </Dialog>
  )
}
