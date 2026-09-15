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
  MenuItem,
  Paper,
  Stack,
  Switch,
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
import SwapVertIcon from '@mui/icons-material/SwapVert'
import { inventoryApi, type InventoryItem } from '../../api/inventory'
import { branchesApi } from '../../api/branches'
import { apiErrorMessage } from '../../api/client'
import { Can } from '../../components/PermissionGate'

export function InventoryPage() {
  const qc = useQueryClient()
  const [branchFilter, setBranchFilter] = useState('')
  const [lowStockOnly, setLowStockOnly] = useState(false)
  const [editing, setEditing] = useState<InventoryItem | null>(null)
  const [creating, setCreating] = useState(false)
  const [confirm, setConfirm] = useState<InventoryItem | null>(null)
  const [adjusting, setAdjusting] = useState<InventoryItem | null>(null)

  const branches = useQuery({ queryKey: ['branches'], queryFn: () => branchesApi.list() })
  const items = useQuery({
    queryKey: ['inventory', branchFilter, lowStockOnly],
    queryFn: () => inventoryApi.list({ branchId: branchFilter || undefined, lowStock: lowStockOnly || undefined }),
  })

  const invalidate = () => qc.invalidateQueries({ queryKey: ['inventory'] })

  const save = useMutation({
    mutationFn: (body: Parameters<typeof inventoryApi.create>[0]) =>
      editing ? inventoryApi.update(editing.id, body) : inventoryApi.create(body),
    onSuccess: () => { setCreating(false); setEditing(null); invalidate() },
  })

  const adjust = useMutation({
    mutationFn: ({ id, delta, reason }: { id: string; delta: number; reason: string }) => inventoryApi.adjust(id, { delta, reason }),
    onSuccess: () => { setAdjusting(null); invalidate() },
  })

  const remove = useMutation({
    mutationFn: (id: string) => inventoryApi.remove(id),
    onSuccess: () => { setConfirm(null); invalidate() },
  })

  const rows = items.data ?? []

  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2, flexWrap: 'wrap', gap: 1 }}>
        <Typography variant="h5" fontWeight={700}>Inventory</Typography>
        <Can permissions={['inventory.manage']}>
          <Button variant="contained" startIcon={<AddIcon />} onClick={() => { setEditing(null); setCreating(true) }}>
            New item
          </Button>
        </Can>
      </Stack>

      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems={{ xs: 'stretch', sm: 'center' }} sx={{ mb: 2 }}>
        <TextField select label="Branch" size="small" value={branchFilter} onChange={(e) => setBranchFilter(e.target.value)} sx={{ minWidth: 200, width: { xs: '100%', sm: 'auto' } }}>
          <MenuItem value="">All branches</MenuItem>
          {(branches.data ?? []).map((b) => <MenuItem key={b.id} value={b.id}>{b.name}</MenuItem>)}
        </TextField>
        <Stack direction="row" alignItems="center">
          <Typography variant="body2">Low stock only</Typography>
          <Switch checked={lowStockOnly} onChange={(e) => setLowStockOnly(e.target.checked)} />
        </Stack>
      </Stack>

      {(save.error || adjust.error || remove.error) && (
        <Alert severity="error" sx={{ mb: 2 }}>{apiErrorMessage(save.error ?? adjust.error ?? remove.error)}</Alert>
      )}

      <TableContainer component={Paper} variant="outlined" sx={{ overflowX: 'auto' }}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Item</TableCell>
              <TableCell>SKU</TableCell>
              <TableCell>Branch</TableCell>
              <TableCell>Quantity</TableCell>
              <TableCell>Min</TableCell>
              <TableCell>Location</TableCell>
              <TableCell align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.map((it) => {
              const low = it.quantity <= it.minQuantity
              return (
                <TableRow key={it.id} hover>
                  <TableCell>{it.name}</TableCell>
                  <TableCell>{it.sku ?? '—'}</TableCell>
                  <TableCell>{it.branch?.name ?? '—'}</TableCell>
                  <TableCell>
                    <Chip label={it.quantity} size="small" color={low ? 'error' : 'default'} />
                  </TableCell>
                  <TableCell>{it.minQuantity} {it.unit ?? ''}</TableCell>
                  <TableCell>{it.location ?? '—'}</TableCell>
                  <TableCell align="right">
                    <Can permissions={['inventory.manage']}>
                      <IconButton title="Adjust quantity" onClick={() => setAdjusting(it)}><SwapVertIcon fontSize="small" /></IconButton>
                      <IconButton onClick={() => { setEditing(it); setCreating(true) }}><EditIcon fontSize="small" /></IconButton>
                      <IconButton color="error" onClick={() => setConfirm(it)}><DeleteIcon fontSize="small" /></IconButton>
                    </Can>
                  </TableCell>
                </TableRow>
              )
            })}
            {rows.length === 0 && <TableRow><TableCell colSpan={7} align="center">No inventory items</TableCell></TableRow>}
          </TableBody>
        </Table>
      </TableContainer>

      {(creating || editing) && (
        <ItemDialog
          item={editing}
          open
          defaultBranchId={branchFilter}
          branchOptions={(branches.data ?? []).map((b) => ({ id: b.id, name: b.name }))}
          onClose={() => { setCreating(false); setEditing(null) }}
          onSave={(body) => save.mutate(body)}
          busy={save.isPending}
        />
      )}

      {adjusting && (
        <AdjustDialog
          item={adjusting}
          onClose={() => setAdjusting(null)}
          busy={adjust.isPending}
          onSave={(delta, reason) => adjust.mutate({ id: adjusting.id, delta, reason })}
        />
      )}

      <Dialog open={confirm !== null} onClose={() => setConfirm(null)} fullWidth maxWidth="xs">
        <DialogTitle>Delete item</DialogTitle>
      <DialogContent sx={{ px: { xs: 2, sm: 3 }, pt: { xs: 1.5, sm: 2 } }}>Delete "{confirm?.name}"?</DialogContent>
      <DialogActions sx={{ px: { xs: 2, sm: 3 }, pb: { xs: 2, sm: 2 }, flexWrap: 'wrap' }}>
          <Button onClick={() => setConfirm(null)}>Cancel</Button>
          <Button color="error" onClick={() => confirm && remove.mutate(confirm.id)}>Delete</Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}

function ItemDialog({
  item,
  open,
  defaultBranchId,
  branchOptions,
  onClose,
  onSave,
  busy,
}: {
  item: InventoryItem | null
  open: boolean
  defaultBranchId: string
  branchOptions: Array<{ id: string; name: string }>
  onClose: () => void
  onSave: (body: Parameters<typeof inventoryApi.create>[0]) => void
  busy: boolean
}) {
  const [branchId, setBranchId] = useState(defaultBranchId || item?.branchId || '')
  const [name, setName] = useState(item?.name ?? '')
  const [sku, setSku] = useState(item?.sku ?? '')
  const [quantity, setQuantity] = useState(String(item?.quantity ?? 0))
  const [unit, setUnit] = useState(item?.unit ?? '')
  const [minQuantity, setMinQuantity] = useState(String(item?.minQuantity ?? 0))
  const [location, setLocation] = useState(item?.location ?? '')
  const isCreate = !item

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>{item ? 'Edit item' : 'New item'}</DialogTitle>
      <DialogContent sx={{ px: { xs: 2, sm: 3 }, pt: { xs: 1.5, sm: 2 } }}>
        <Stack spacing={2} sx={{ pt: 1 }}>
          {isCreate && (
            <TextField select label="Branch" value={branchId} onChange={(e) => setBranchId(e.target.value)} fullWidth>
              {branchOptions.map((b) => <MenuItem key={b.id} value={b.id}>{b.name}</MenuItem>)}
            </TextField>
          )}
          <TextField label="Name" value={name} onChange={(e) => setName(e.target.value)} fullWidth />
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            <TextField label="SKU" value={sku} onChange={(e) => setSku(e.target.value)} fullWidth />
            <TextField label="Unit" value={unit} onChange={(e) => setUnit(e.target.value)} fullWidth />
          </Stack>
          {isCreate && (
            <TextField label="Quantity" type="number" value={quantity} onChange={(e) => setQuantity(e.target.value)} fullWidth />
          )}
          <TextField label="Min quantity" type="number" value={minQuantity} onChange={(e) => setMinQuantity(e.target.value)} fullWidth />
          <TextField label="Location" value={location} onChange={(e) => setLocation(e.target.value)} fullWidth />
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: { xs: 2, sm: 3 }, pb: { xs: 2, sm: 2 }, flexWrap: 'wrap' }}>
        <Button onClick={onClose}>Cancel</Button>
        <Button
          variant="contained"
          disabled={busy || !name || (isCreate && !branchId)}
          onClick={() => onSave({
            branchId: isCreate ? branchId : item.branchId,
            name,
            sku: sku || null,
            quantity: isCreate ? parseInt(quantity || '0', 10) : undefined,
            unit: unit || null,
            minQuantity: parseInt(minQuantity || '0', 10),
            location: location || null,
          } as Parameters<typeof inventoryApi.create>[0])}
        >
          Save
        </Button>
      </DialogActions>
    </Dialog>
  )
}

function AdjustDialog({
  item,
  onClose,
  busy,
  onSave,
}: {
  item: InventoryItem
  onClose: () => void
  busy: boolean
  onSave: (delta: number, reason: string) => void
}) {
  const [delta, setDelta] = useState('')
  const [reason, setReason] = useState('')

  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle>Adjust {item.name}</DialogTitle>
      <DialogContent sx={{ px: { xs: 2, sm: 3 }, pt: { xs: 1.5, sm: 2 } }}>
        <Stack spacing={2} sx={{ pt: 1 }}>
          <TextField
            label="Quantity change"
            type="number"
            value={delta}
            onChange={(e) => setDelta(e.target.value)}
            fullWidth
            helperText="Positive adds stock, negative removes it. Current quantity: {item.quantity}"
          />
          <TextField label="Reason" value={reason} onChange={(e) => setReason(e.target.value)} fullWidth />
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: { xs: 2, sm: 3 }, pb: { xs: 2, sm: 2 }, flexWrap: 'wrap' }}>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" disabled={busy || !delta || delta === '0' || !reason} onClick={() => onSave(parseInt(delta, 10), reason)}>
          Save
        </Button>
      </DialogActions>
    </Dialog>
  )
}
