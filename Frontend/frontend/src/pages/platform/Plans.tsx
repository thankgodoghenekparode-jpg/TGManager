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
  TablePagination,
  TableRow,
  TextField,
  Typography,
} from '@mui/material'
import AddIcon from '@mui/icons-material/Add'
import EditIcon from '@mui/icons-material/Edit'
import DeleteIcon from '@mui/icons-material/Delete'
import { platformApi, type PlatformPlan } from '../../api/platform'
import { apiErrorMessage } from '../../api/client'

export function PlansPage() {
  const qc = useQueryClient()
  const [page, setPage] = useState(0)
  const [rowsPerPage, setRowsPerPage] = useState(10)
  const [editing, setEditing] = useState<PlatformPlan | null>(null)
  const [creating, setCreating] = useState(false)
  const [confirm, setConfirm] = useState<PlatformPlan | null>(null)

  const plans = useQuery({ queryKey: ['platform', 'plans'], queryFn: () => platformApi.plans() })

  const invalidate = () => qc.invalidateQueries({ queryKey: ['platform', 'plans'] })

  const save = useMutation({
    mutationFn: (body: { name: string; code: string; priceCents: number }) =>
      editing
        ? platformApi.updatePlan(editing.id, body)
        : platformApi.createPlan(body),
    onSuccess: () => {
      setCreating(false)
      setEditing(null)
      invalidate()
    },
  })

  const remove = useMutation({
    mutationFn: (id: string) => platformApi.deactivatePlan(id),
    onSuccess: () => {
      setConfirm(null)
      invalidate()
    },
  })

  const rows = plans.data ?? []

  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2, flexWrap: 'wrap', gap: 1 }}>
        <Typography variant="h5" fontWeight={700}>Plans</Typography>
        <Button variant="contained" startIcon={<AddIcon />} onClick={() => { setEditing(null); setCreating(true) }}>
          New plan
        </Button>
      </Stack>

      {(save.error || remove.error) && (
        <Alert severity="error" sx={{ mb: 2 }}>{apiErrorMessage(save.error ?? remove.error)}</Alert>
      )}

      <TableContainer component={Paper} variant="outlined" sx={{ overflowX: 'auto' }}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Name</TableCell>
              <TableCell>Code</TableCell>
              <TableCell align="right">Price</TableCell>
              <TableCell align="right">Branches</TableCell>
              <TableCell align="right">Staff</TableCell>
              <TableCell align="right">Active</TableCell>
              <TableCell align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.map((p) => (
              <TableRow key={p.id} hover>
                <TableCell>{p.name}</TableCell>
                <TableCell><Chip label={p.code} size="small" /></TableCell>
                <TableCell align="right">${(p.priceCents / 100).toFixed(2)}</TableCell>
                <TableCell align="right">{p.maxBranches ?? '∞'}</TableCell>
                <TableCell align="right">{p.maxStaff ?? '∞'}</TableCell>
                <TableCell align="right">{p.isActive ? <Chip label="Active" size="small" color="success" /> : <Chip label="Off" size="small" color="default" />}</TableCell>
                <TableCell align="right">
                  <IconButton onClick={() => { setEditing(p); setCreating(true) }}><EditIcon fontSize="small" /></IconButton>
                  <IconButton color="error" onClick={() => setConfirm(p)}><DeleteIcon fontSize="small" /></IconButton>
                </TableCell>
              </TableRow>
            ))}
            {rows.length === 0 && <TableRow><TableCell colSpan={7} align="center">No plans</TableCell></TableRow>}
          </TableBody>
        </Table>
      </TableContainer>

      <TablePagination
        component="div"
        count={rows.length}
        rowsPerPageOptions={[10]}
        rowsPerPage={rowsPerPage}
        page={page}
        onPageChange={(_, p) => setPage(p)}
        onRowsPerPageChange={(e) => setRowsPerPage(parseInt(e.target.value, 10))}
      />

      {creating && (
        <PlanEditDialog
          plan={editing}
          open={creating}
          onClose={() => { setCreating(false); setEditing(null) }}
          onSave={(body) => save.mutate(body)}
          busy={save.isPending}
        />
      )}

      <Dialog open={confirm !== null} onClose={() => setConfirm(null)} fullWidth maxWidth="xs">
        <DialogTitle>Deactivate plan</DialogTitle>
        <DialogContent>Deactivate "{confirm?.name}"? Existing subscribers are unaffected.</DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirm(null)}>Cancel</Button>
          <Button color="error" onClick={() => confirm && remove.mutate(confirm.id)}>Deactivate</Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}

function PlanEditDialog({
  plan,
  open,
  onClose,
  onSave,
  busy,
}: {
  plan: PlatformPlan | null
  open: boolean
  onClose: () => void
  onSave: (body: { name: string; code: string; priceCents: number }) => void
  busy: boolean
}) {
  const [name, setName] = useState(plan?.name ?? '')
  const [code, setCode] = useState(plan?.code ?? '')
  const [priceDollars, setPriceDollars] = useState(plan ? (plan.priceCents / 100).toString() : '0')

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle>{plan ? 'Edit plan' : 'New plan'}</DialogTitle>
      <DialogContent sx={{ px: { xs: 2, sm: 3 }, pt: { xs: 1.5, sm: 2 } }}>
        <Stack spacing={2} sx={{ pt: 1 }}>
          <TextField label="Name" value={name} onChange={(e) => setName(e.target.value)} fullWidth />
          <TextField label="Code" value={code} disabled={!!plan} onChange={(e) => setCode(e.target.value)} fullWidth />
          <TextField
            label="Price (USD / month)"
            type="number"
            value={priceDollars}
            onChange={(e) => setPriceDollars(e.target.value)}
            fullWidth
          />
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: { xs: 2, sm: 3 }, pb: { xs: 2, sm: 2 }, flexWrap: 'wrap' }}>
        <Button onClick={onClose}>Cancel</Button>
        <Button
          variant="contained"
          disabled={busy || !name || !code}
          onClick={() => onSave({ name, code, priceCents: Math.round(parseFloat(priceDollars || '0') * 100) })}
        >
          Save
        </Button>
      </DialogActions>
    </Dialog>
  )
}
